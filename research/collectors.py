"""Source adapters with bounded, resumable collection and explicit coverage reports."""
import hashlib
import json
from datetime import datetime
from urllib.parse import urlencode,urljoin,urlsplit,urldefrag
from .network import Fetcher,FetchError
from .htmlparse import Document
from .model import now,safe_url


def iso(v):
    if not v: return ''
    for fmt in ('%Y-%m-%d','%m/%d/%Y'):
        try: return datetime.strptime(str(v)[:10],fmt).date().isoformat()
        except ValueError: pass
    return ''

def base(source,record_id,url):
    return {'source_id':source['id'],'source_record_id':str(record_id),'source_url':url,
            'kind':'funded_research','status':'unknown','reviewed':False,'collected_at':now(),
            'evidence':[{'field':'record','url':url,'checked_at':now(),'method':'official_source_fetch'}]}

def nih_record(x,s):
    id=x.get('appl_id')
    if id is None or not x.get('project_title'): raise ValueError('NIH record schema changed')
    url=safe_url(x.get('project_detail_url')) or f'https://reporter.nih.gov/project-details/{id}'
    p=base(s,id,url); org=x.get('organization') or {}
    p.update(title=x['project_title'],description=x.get('abstract_text') or '',
        institution=org.get('org_name',''),department=org.get('dept_type',''),region=org.get('org_country',''),
        start_date=iso(x.get('project_start_date')),end_date=iso(x.get('project_end_date')),
        period_text=f"研究资助周期：{iso(x.get('project_start_date')) or '未公布'} 至 {iso(x.get('project_end_date')) or '未公布'}（不是学生参与周期）",
        mentors=[i.get('full_name') or ' '.join(filter(None,[i.get('first_name'),i.get('last_name')])) for i in (x.get('principal_investigators') or [])],
        team=org.get('org_name',''),warnings=['PI 是项目负责人，不代表已确认学生导师；未提供学生招募证据。'])
    return p

def nsf_record(x,s):
    if not x.get('id') or not x.get('title'): raise ValueError('NSF record schema changed')
    p=base(s,x['id'],'https://www.nsf.gov/awardsearch/showAward?AWD_ID='+str(x['id']))
    p.update(title=x['title'],description=x.get('abstractText',''),institution=x.get('awardeeName',''),region='美国',
        start_date=iso(x.get('startDate')),end_date=iso(x.get('expDate')),
        period_text=f"研究资助周期：{x.get('startDate','未公布')} 至 {x.get('expDate','未公布')}（不是学生参与周期）",
        mentors=[x['piFullName']] if x.get('piFullName') else [],team=x.get('awardeeName',''),
        warnings=['资助项目线索；负责人不等于已确认学生导师，学生招募资格与申请方式未知。'])
    return p

def hkust_record(html,url,s):
    d=Document(html)
    stops=['Project Description','Supervisor','Quota','Course type',"Applicant's Roles",'Special Requirements',"Applicant's Learning Objectives",'Complexity of the project','Apply','Return home']
    desc=d.section('Project Description',stops)
    if not desc: raise ValueError('HKUST detail labels missing; parser needs review')
    p=base(s,url,url)
    p.update(title=d.title,description=desc,kind='project',institution='香港科技大学',region='中国香港',
        mentors=[d.section('Supervisor',stops)] if d.section('Supervisor',stops) else [],
        eligibility_text=d.section('Special Requirements',stops),required_institution='香港科技大学',
        application_method='先核对 UROP 学生资格与当期安排，再通过项目原页 Apply 入口申请。',
        application_url=url,work_types=[],warnings=['需同时核对 UROP 通用资格；本次解析未确认当前名额。'])
    p['evidence'].append({'field':'required_institution','url':'https://urop.hkust.edu.hk/For_Students','checked_at':'2026-10-18','method':'manual_review'})
    return p

def generic_record(html,url,s):
    d=Document(html)
    if not d.title: raise ValueError('Page title missing')
    p=base(s,url,url)
    p.update(title=d.title,kind='lead',description='',institution=s.get('institution',''),region=s.get('region',''),
             warnings=['网页线索，尚未审核为具体科研项目；请人工整理原文后导入。'])
    # Evidence excerpt is labeled as page text, never misrepresented as a research abstract.
    p['evidence'][0]['excerpt']=d.text[:1200]
    for field,label in s.get('field_labels',{}).items():
        if field in ('description','team','period_text','eligibility_text','application_method'):
            p[field]=d.section(label,list(s.get('field_labels',{}).values()))[:30000]
    return p

def collect(store,source,query='',max_pages=2,reset=False,fetcher=None,progress=None):
    if not 1<=max_pages<=50: raise ValueError('max_pages 必须为1到50')
    key=source['id']+':'+hashlib.sha256(query.encode()).hexdigest()[:16]
    state={} if reset else store.value('state',key,{})
    f=fetcher or Fetcher(source['allowed_hosts'],source.get('delay',1.1))
    report={'source_id':source['id'],'query':query,'started_at':now(),'pages':0,'created':0,'updated':0,
            'unchanged':0,'errors':[],'complete':False,'exhausted':False,'status':'running'}
    if state.get('exhausted') and not reset:
        report.update(status='already_exhausted',exhausted=True,finished_at=now()); return report
    try:
        if source['type'] in ('nih','nsf'):
            offset=state.get('offset',0 if source['type']=='nih' else 1)
            for _ in range(max_pages):
                if source['type']=='nih':
                    if offset>14999:
                        report['errors'].append('NIH offset limit reached; partition query by fiscal year/criteria'); break
                    criteria=dict(source.get('criteria',{}))
                    if query: criteria['advanced_text_search']={'operator':'and','search_field':'all','search_text':query}
                    response=f.json(source['endpoint'],{'criteria':criteria,'offset':offset,'limit':100})
                    rows=response.get('results')
                    total=response.get('meta',{}).get('total')
                    mapper=nih_record
                else:
                    params={'offset':offset,'rpp':25,'printFields':'id,title,abstractText,awardeeName,piFullName,startDate,expDate'}
                    if query: params['keyword']=query
                    response=f.json(source['endpoint']+'?'+urlencode(params))
                    rows=response.get('response',{}).get('award'); total=None; mapper=nsf_record
                if not isinstance(rows,list): raise ValueError('API schema changed: records array missing')
                records=[mapper(x,source) for x in rows]
                counts=store.upsert(records,'public')
                for k in ('created','updated','unchanged'): report[k]+=counts[k]
                offset+=len(rows); report['pages']+=1
                exhausted=not rows or (total is not None and offset>=total)
                state={'offset':offset,'exhausted':exhausted,'updated_at':now()}
                store.set_value('state',key,state)
                if progress: progress(report)
                if exhausted: break
        elif source['type'] in ('hkust','web'):
            queue=state.get('queue',list(source.get('urls',[]))); seen=set(state.get('seen',[]))
            for _ in range(max_pages):
                if not queue: break
                url=queue[0]
                html=f.page(url); doc=Document(html)
                candidates=[]
                for href,_label in doc.links:
                    target=urldefrag(urljoin(url,href))[0]; parsed=urlsplit(target)
                    prefixes=source.get('follow_prefixes',[])
                    if parsed.hostname in source['allowed_hosts'] and parsed.scheme=='https' and any(parsed.path.startswith(x) for x in prefixes):
                        if target not in seen and target not in queue and target not in candidates: candidates.append(target)
                records=[]
                if source['type']=='hkust':
                    if urlsplit(url).path.startswith('/projects/'):
                        records=[hkust_record(html,url,source)]
                elif url not in source.get('index_urls',[]):
                    records=[generic_record(html,url,source)]
                counts=store.upsert(records,'public')
                for k in ('created','updated','unchanged'): report[k]+=counts[k]
                if source['type']=='hkust':
                    candidates.sort(key=lambda u: not urlsplit(u).path.startswith('/projects/'))
                seen.add(url); queue=queue[1:]+candidates
                if len(queue)>50000:
                    report['errors'].append('Crawl frontier capped at 50000; split source configuration to cover more pages')
                state={'queue':queue[:50000],'seen':sorted(seen),'exhausted':not queue,'updated_at':now()}
                store.set_value('state',key,state); report['pages']+=1
                if progress: progress(report)
        else: raise ValueError('Unknown collector type')
        report['exhausted']=state.get('exhausted',False)
        report['status']='finished' if report['exhausted'] else 'paused'
    except (FetchError,OSError,ValueError,KeyError,TypeError) as e:
        report['errors'].append(str(e)); report['status']='failed'
    # exhausted means only this query/seed frontier, NEVER global completeness.
    report['finished_at']=now(); report['cursor']=state
    return report
