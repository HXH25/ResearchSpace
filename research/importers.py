"""Local SRT import. Does not publish school-authenticated information."""
import json
import zipfile
from pathlib import Path
from .model import now


def month(v):
    s=str(v or '')
    return s[:4]+'-'+s[4:6] if len(s)==6 and s.isdigit() else s

def srt_records(path):
    path=Path(path)
    if path.suffix.lower()=='.zip':
        with zipfile.ZipFile(path) as z:
            names=[n for n in z.namelist() if n.endswith('/project_details.json') or n=='project_details.json']
            if len(names)!=1: raise ValueError('ZIP 必须包含唯一 project_details.json')
            info=z.getinfo(names[0])
            if info.file_size>100_000_000: raise ValueError('SRT JSON 超过100MB限制')
            rows=json.loads(z.read(names[0]))
    else: rows=json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(rows,list): raise ValueError('SRT details 必须是数组')
    records=[]
    url='https://info.tsinghua.edu.cn/f/info/gxfw_fg/common/index'
    for r in rows:
        if not isinstance(r, dict) or not r.get('project_id'): raise ValueError('SRT record missing project_id')
        records.append({'source_id':'thu_srt_private','source_record_id':r['project_id'],
            'title':r.get('title',''),'description':r.get('description',''),
            'institution':'清华大学','department':r.get('department',''),'region':'中国大陆',
            'kind':'project','visibility':'private','source_url':url,
            'collected_at':r.get('collected_at') or now(),'status':'unknown','source_status':r.get('status',''),
            'mentors':[r['mentor']] if r.get('mentor') else [],'team':r.get('mentor_team',''),
            'mentor_background':r.get('mentor_experience') or '',
            'srt':dict(r),
            'period_text':month(r.get('start_month'))+' 至 '+month(r.get('end_month'))+'\n'+(r.get('schedule') or ''),
            'eligibility_text':r.get('eligibility') or '',
            'application_method':'使用本人授权账号进入 THU info → SRT → 学生报名，核对当前批次和项目编号 '+r['project_id'],
            'application_url':url,'required_institution':'清华大学','reviewed':False,
            'warnings':['校内登录数据，仅供本地授权使用；原始报名中状态不代表当前仍开放。','接纳人数不等于剩余名额；学生立项人不等于导师。'],
            'evidence':[{'field':'record','url':url,'source_record_id':r['project_id'],'checked_at':r.get('collected_at'),'method':'user_authorized_local_import'}]})
    return records
