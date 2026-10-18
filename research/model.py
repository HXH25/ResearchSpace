"""Canonical data, conservative recruitment state, and profile validation."""
from datetime import date, datetime, timezone
from urllib.parse import urlsplit
import hashlib
import re

KINDS = {'project', 'program', 'funded_research', 'funding_call', 'lead'}
STATUSES = {'unknown', 'open', 'closed', 'upcoming', 'rolling'}
TEXT_FIELDS = ['title','description','institution','department','region','period_text','start_date','end_date',
               'deadline','eligibility_text','application_method','application_url','team','mentor_background',
               'source_id','source_url','source_record_id','collected_at','status_verified_at','status_evidence',
               'required_institution','excluded_institution','source_status','required_language','required_start','required_end']
LIST_FIELDS = ['mentors','tags','skills','work_types','goals','allowed_degrees','evidence','warnings']

def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

def parse_date(v):
    if not v:
        return None
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        return None

def safe_url(v):
    if not isinstance(v, str):
        return ''
    try:
        p=urlsplit(v)
        return v if p.scheme in ('http','https') and p.hostname and not p.username and not p.password else ''
    except ValueError:
        return ''

def normalize(raw, visibility=None):
    if not isinstance(raw, dict):
        raise ValueError('项目必须是对象')
    p={key: str(raw.get(key) or '')[:100000] for key in TEXT_FIELDS}
    if not p['title'].strip() or not safe_url(p['source_url']):
        raise ValueError('项目缺少 title 或有效 source_url')
    p['source_url']=safe_url(p['source_url'])
    p['application_url']=safe_url(p['application_url'])
    p['source_id']=p['source_id'] or 'manual'
    p['source_record_id']=p['source_record_id'] or p['source_url']
    # Source-native identities are stable. No unsafe fuzzy merge of names/titles.
    p['id']=hashlib.sha256((p['source_id']+'|'+p['source_record_id']).encode()).hexdigest()[:24]
    for k in LIST_FIELDS:
        v=raw.get(k,[])
        if not isinstance(v,list) or len(v)>1000:
            raise ValueError(k+' 必须是数组（最多1000项）')
        p[k]=v if k=='evidence' else [str(x)[:2000] for x in v]
    for e in p['evidence']:
        if not isinstance(e,dict) or not safe_url(e.get('url')):
            raise ValueError('evidence 每项必须有有效 url')
    p['visibility']=visibility or raw.get('visibility','public')
    if p['visibility'] not in ('public','private'):
        raise ValueError('visibility 无效')
    p['kind']=raw.get('kind','lead')
    p['status']=raw.get('status','unknown')
    if p['kind'] not in KINDS or p['status'] not in STATUSES:
        raise ValueError('kind/status 无效')
    p['reviewed']=raw.get('reviewed') is True
    if 'srt' in raw:
        details = raw['srt']
        if not isinstance(details, dict) or len(details) > 60 or any(not isinstance(k, str) or len(k) > 100 or (v is not None and type(v) not in (str, int, bool)) or (isinstance(v, str) and len(v) > 100000) for k, v in details.items()):
            raise ValueError('SRT 原始字段格式无效')
        if details.get('initiation_type') not in (None, '', 'teacher', 'student'):
            raise ValueError('SRT 立项类型无效')
        p['srt'] = dict(details)
    if p['source_id'] == 'thu_srt_private':
        p['visibility'] = 'private'
    p['collected_at']=p['collected_at'] or now()
    for k in ('start_date','end_date','deadline','required_start','required_end'):
        if p[k] and not parse_date(p[k]):
            raise ValueError(k+' 必须使用 ISO 日期 YYYY-MM-DD')
    for k in ('min_year','min_hours'):
        v=raw.get(k)
        if v is not None and (isinstance(v,bool) or not isinstance(v,(int,float)) or not 0<=v<=168):
            raise ValueError(k+' 必须是有效非负数')
        p[k]=v
    return p

def effective_status(p, today=None):
    today=today or date.today()
    deadline=parse_date(p.get('deadline'))
    if deadline and deadline<today:
        return 'closed'
    if p['kind'] in ('funded_research','lead'):
        return 'unknown'
    verified=parse_date(p.get('status_verified_at'))
    if not verified or not 0 <= (today-verified).days <= 30:
        return 'unknown'
    if not p.get('reviewed') or not p.get('status_evidence'):
        return 'unknown'
    # A rolling page / forecast is never automatically promoted to confirmed open.
    return p.get('status','unknown')

def present(p):
    return dict(p, effective_status=effective_status(p),
                missing_fields=[k for k in ('description','period_text','mentors','team','application_method','eligibility_text') if not p.get(k)])

def validate_profile(raw):
    if not isinstance(raw,dict):
        raise ValueError('profile 必须是 JSON 对象')
    p={}
    for k in ('interests','skills','work_types','goals','regions','languages'):
        v=raw.get(k,[])
        if not isinstance(v,list) or len(v)>40 or any(not isinstance(x,str) or len(x)>200 for x in v):
            raise ValueError(k+' 必须是最多40个短字符串的数组')
        p[k]=[x.strip() for x in v if x.strip()]
    for k in ('institution','degree','start_date','end_date','experience'):
        v=raw.get(k,'')
        if not isinstance(v,str) or len(v)>4000:
            raise ValueError(k+' 必须是字符串')
        p[k]=v.strip()
    for k, maximum in [('year',12),('hours_per_week',168)]:
        v=raw.get(k)
        if v in (None,''):
            p[k]=None
        elif isinstance(v,bool) or not isinstance(v,(int,float)) or not 0<=v<=maximum:
            raise ValueError(k+' 数值无效')
        else:
            p[k]=v
    for k in ('start_date','end_date'):
        if p[k] and not parse_date(p[k]):
            raise ValueError(k+' 日期无效')
    if p['start_date'] and p['end_date'] and p['start_date']>p['end_date']:
        raise ValueError('结束日期不能早于开始日期')
    return p
