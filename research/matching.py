"""Deterministic bilingual matching. Scores are fit references, not admission odds."""
import re
from .model import parse_date, effective_status, present

ALIASES = [
 ['机器人','robotics','robot','机器人学'], ['机器学习','machine learning'],
 ['人工智能','artificial intelligence','ai'], ['深度学习','deep learning'],
 ['计算机视觉','computer vision','视觉'], ['半导体','semiconductor','transistor','晶体管'],
 ['生物医学','biomedical','bioengineering','生物工程'], ['量子','quantum'],
 ['三维打印','3d printing','3d打印','增材制造'], ['材料','materials'],
 ['计算机','computer science','cs'], ['数学','mathematics','math'],
 ['物理','physics'], ['化学','chemistry'], ['电子','electrical engineering','electronics'],
 ['暑研','summer research','summer'], ['实验','experiment','experimental'],
 ['代码','coding','programming'], ['理论','theory','theoretical'],
 ['数据分析','data analysis'], ['文献','literature'],
 ['清华大学','清华','tsinghua university','tsinghua'],
 ['香港科技大学','港科大','hkust','hong kong university of science and technology'],
 ['eth zurich','eth zürich','苏黎世联邦理工学院','eth'],
 ['本科','bachelor','undergraduate'], ['硕士','master','msc'], ['博士','phd','doctoral'],
 ['英语','english','en'], ['中文','chinese','zh'],
 ['瑞士','switzerland'], ['中国香港','hong kong'], ['美国','united states','usa'],
]

def variants(term):
    t=term.strip().casefold()
    for group in ALIASES:
        if t in group:
            return group
    return [t]

def contains(text, term):
    text=text.casefold()
    for v in variants(term):
        if re.fullmatch(r'[a-z0-9 +.-]+',v):
            if re.search(r'(?<![a-z0-9])'+re.escape(v)+r'(?![a-z0-9])',text):
                return True
        elif v in text:
            return True
    return False

def same(a,b):
    return bool(a and b) and bool(set(variants(a)) & set(variants(b)))

def searchable(p):
    text = ' '.join(str(p.get(k,'')) for k in ('title','description','institution','department','team','mentor_background','tags','skills','mentors','eligibility_text','period_text','source_record_id'))
    srt = p.get('srt') or {}
    return text + ' ' + ' '.join(str(srt.get(k) or '') for k in ('applicant','mentor_department','academic_term','expected_outcomes','resources'))

def query_match(p,q):
    from .fuzzy import fuzzy_score
    return bool(fuzzy_score(searchable(p), q))

def assess(p,profile):
    conflicts=[]; unknown=[]; reasons=[]; preparations=[]
    if p.get('required_institution'):
        if not profile['institution']:
            unknown.append('需确认在读学校是否符合限制')
        elif not same(profile['institution'],p['required_institution']):
            conflicts.append('仅面向 '+p['required_institution']+' 在读学生')
    if p.get('excluded_institution'):
        if not profile['institution']:
            unknown.append('需核实项目对本校学生的排除条件')
        elif same(profile['institution'],p['excluded_institution']):
            conflicts.append('该项目不接收 '+p['excluded_institution']+' 在读学生')
    if p.get('allowed_degrees'):
        if not profile['degree']:
            unknown.append('需确认学历阶段')
        elif not any(same(profile['degree'],x) for x in p['allowed_degrees']):
            conflicts.append('学历阶段不满足已知要求')
    if p.get('min_year') is not None:
        if profile['year'] is None:
            unknown.append('需确认年级')
        elif profile['degree'] not in ('master','硕士','phd','博士') and profile['year']<p['min_year']:
            conflicts.append('尚未达到最低年级要求')
    if p.get('min_hours') is not None:
        if profile['hours_per_week'] is None:
            unknown.append('需确认每周可投入时间')
        elif profile['hours_per_week']<p['min_hours']:
            conflicts.append('每周可投入时间低于项目要求')
    else:
        unknown.append('项目未公布每周投入要求')
    if p.get('required_language'):
        if not profile['languages']:
            unknown.append('需确认工作语言能力')
        elif not any(same(x,p['required_language']) for x in profile['languages']):
            conflicts.append('工作语言与填写的语言能力不符')
    # Only required participant dates impose hard constraints; award dates do not.
    for key,op,msg in [('required_start',lambda a,b:a>b,'无法覆盖要求的开始日期'),('required_end',lambda a,b:a<b,'无法覆盖要求的结束日期')]:
        needed=parse_date(p.get(key)); available=parse_date(profile['start_date' if key=='required_start' else 'end_date'])
        if needed and not available:
            unknown.append('需确认可参与日期')
        elif needed and op(available,needed):
            conflicts.append(msg)
    if not p.get('eligibility_text'):
        unknown.append('申请资格未公布')
    else:
        unknown.append('其他资格条件仍须按原公告人工确认')
    if not p.get('mentors'):
        unknown.append('导师尚未明确')
    if not p.get('application_method'):
        unknown.append('申请方式尚未明确')
    status=effective_status(p)
    if status!='open':
        unknown.append({'closed':'当前申请已关闭','upcoming':'申请窗口尚未开放','rolling':'页面标注滚动招募，需核实当前名额'}.get(status,'尚未确认当前开放申请'))
    text=searchable(p)
    matches=[x for x in profile['interests'] if contains(text,x)]
    interest=55*len(matches)/max(1,len(profile['interests']))
    if matches:
        reasons.append('兴趣交集：'+'、'.join(matches))
    elif profile['interests']:
        preparations.append('未找到明确兴趣交集，可尝试更宽的研究关键词')
    skill_hits=[x for x in profile['skills'] if contains(text,x)]
    required=p.get('skills',[])
    missing=[x for x in required if not any(same(x,y) for y in profile['skills'])]
    skill_score=20*(len(required)-len(missing))/len(required) if required else min(20,5*len(skill_hits))
    if skill_hits:
        reasons.append('技能关联：'+'、'.join(skill_hits))
    if missing:
        preparations.append('建议准备：'+'、'.join(missing))
    work_hits=[x for x in profile['work_types'] if contains(' '.join(p.get('work_types',[]))+' '+text,x)]
    work_score=10*len(work_hits)/max(1,len(profile['work_types']))
    if work_hits:
        reasons.append('工作方式：'+'、'.join(work_hits))
    region_score=5 if profile['regions'] and any(same(x,p.get('region','')) for x in profile['regions']) else 0
    goal_hits=[x for x in profile['goals'] if contains(' '.join(p.get('goals',[]))+' '+text,x)]
    goal_score=10*len(goal_hits)/max(1,len(profile['goals']))
    score=round(interest+skill_score+work_score+region_score+goal_score,1)
    components={'兴趣':round(interest,1),'技能':round(skill_score,1),'工作方式':round(work_score,1),'地区':region_score,'目标':round(goal_score,1)}
    return dict(present(p),match={'score':score,'components':components,'reasons':reasons,
         'eligibility':'conflict' if conflicts else 'needs_check','conflicts':conflicts,
         'unknowns':list(dict.fromkeys(unknown)),'preparations':preparations,
         'note':'适配参考分，不是录取概率；资格需以官方审核为准'})
