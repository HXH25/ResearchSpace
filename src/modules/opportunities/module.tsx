import { useEffect, useState } from 'react';
import { Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import type { ModulePageProps, ResearchModule } from '@/sdk/contracts';
import { CONTRACT_VERSION } from '@/sdk/contracts';
import { localRequest } from '@/integrations/client';
import { parseProject, parseProjects, type Project } from '@/integrations/projects';
import { Tabs } from '@/ui/Tabs';
import { WebSearchPanel } from '@/ui/WebSearchPanel';

function labels(api: ModulePageProps['api']) { return (zh: string, en: string) => api.config.ui?.locale === 'en' ? en : zh; }
function Status({p, l}: {p: Project; l: (zh: string, en: string) => string}) {
  const values: Record<string, string> = {open: l('开放已核实', 'Verified open'), upcoming: l('即将开放', 'Upcoming'), closed: l('已关闭', 'Closed'), rolling: l('滚动招募待核实', 'Rolling; verify availability'), unknown: l('招募状态待核实', 'Recruitment unverified')};
  return <span className="op-badge">{values[p.effective_status] || values.unknown}</span>;
}
function SrtDetails({p, api}: {p: Project; api: ModulePageProps['api']}) {
  const l = labels(api); const s = p.srt;
  if (!s) return null;
  const value = (v: unknown) => v === null ? l('来源表未提供此字段', 'Not present in the source form') : v === undefined ? l('资料未提供', 'Not provided') : String(v).trim() ? String(v) : l('原文留空', 'Blank in the source');
  const fields: [string, unknown][] = [
    [l('立项人', 'Applicant'), s.applicant], [l('立项人院系', 'Applicant department'), s.department],
    [l('导师院系', 'Mentor department'), s.mentor_department], [l('导师职称', 'Mentor title'), s.mentor_title],
    [l('项目类别', 'Category'), s.category], [l('学分', 'Credits'), s.credits],
    [l('接纳人数（非剩余名额）', 'Capacity (not remaining places)'), s.capacity],
    [l('预期成果', 'Expected outcomes'), s.expected_outcomes], [l('时间与进度安排', 'Schedule'), s.schedule],
    [l('现有物质基础', 'Available resources'), s.resources],
    [l('申请资助金额（非获批金额）', 'Requested funding (not awarded)'), s.funding_requested],
    [l('项目预算', 'Budget'), s.budget], [l('其他经费', 'Other funding'), s.other_funding],
    ...(s.initiation_type === 'student' ? [[l('立项人班级', 'Applicant class'), s.applicant_class], [l('立项人经历及获奖', 'Applicant experience and awards'), s.applicant_experience_awards]] as [string, unknown][] : [[l('导师获奖情况', 'Mentor awards'), s.mentor_awards]] as [string, unknown][]),
  ];
  return <section className="settings-card"><h2>{l('SRT 项目原始资料', 'SRT source details')}</h2><p>{s.project_id} · {s.initiation_type === 'student' ? l('学生立项', 'Student initiated') : s.initiation_type === 'teacher' ? l('教师立项', 'Faculty initiated') : l('立项类型未注明', 'Initiation type unknown')} · {value(s.academic_term)} · {l('批次', 'Batch')} {value(s.batch)}</p><p>{l('采集时列表状态：', 'Status when collected: ')}{value(s.status)}{l('；当前是否仍可报名，请到校内系统核实。', '; verify current availability in the university portal.')}</p><div className="settings-grid">{fields.map(([title, text]) => <div key={title}><h3>{title}</h3><p className="pre-line">{value(text)}</p></div>)}</div></section>;
}
function List({profile, api}: ModulePageProps) {
  const l = labels(api); const [params, setParams] = useSearchParams(); const q = params.get('q') || '';
  const [input, setInput] = useState(q); const [tab, setTab] = useState<'catalog' | 'web'>('catalog');
  const [items, setItems] = useState<Project[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1);
  const projectType = ['srt', 'teacher', 'student'].includes(params.get('type') || '') ? params.get('type')! : '';
  const [status, setStatus] = useState(''); const [mode, setMode] = useState('recommend'); const [hideConflicts, setHideConflicts] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {let alive = true; void api.storage.get<string[]>('saved-projects').then(x => {if (alive) setSaved(Array.isArray(x) ? x : []);}).catch(e => setError(e.message)); return () => {alive = false;};}, [api.storage]);
  useEffect(() => {setInput(q); setPage(1); setTab('catalog');}, [q, projectType]);
  useEffect(() => {
    if (tab !== 'catalog') return;
    const c = new AbortController(); setBusy(true); setError('');
    const typeFilters = projectType ? {source_id: 'thu_srt_private', ...(projectType !== 'srt' ? {initiation_type: projectType} : {})} : {};
    const filters = {q, status, page, page_size: 12, hide_conflicts: hideConflicts, ...typeFilters};
    const request = mode === 'recommend'
      ? localRequest(profile.userId, '/api/recommend', {method: 'POST', body: JSON.stringify({profile, filters}), signal: c.signal})
      : localRequest(profile.userId, '/api/projects?' + new URLSearchParams({q, status, page: String(page), page_size: '12', ...(projectType ? {source_id: 'thu_srt_private', initiation_type: projectType === 'srt' ? '' : projectType} : {})}), {signal: c.signal});
    void request.then(parseProjects).then(data => {if (!c.signal.aborted) {setItems(data.items); setTotal(data.total);}}).catch(e => {if (!c.signal.aborted) setError(e.message);}).finally(() => {if (!c.signal.aborted) setBusy(false);});
    return () => c.abort();
  }, [profile, q, status, page, hideConflicts, mode, retry, tab, projectType]);
  async function toggle(id: string) {
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
    try {await api.storage.set('saved-projects', next); setSaved(next);} catch (e) {setError((e as Error).message);}
  }
  return <div className="op-page"><header className="op-heading"><p className="eyebrow">RESEARCH OPPORTUNITIES</p><h1>{l('让兴趣，遇见具体的机会。', 'Find an opportunity for your curiosity.')}</h1><p>{l('公开版不附带校内 SRT 数据；仍可搜索公开项目，并在设置中自行导入有权限使用的 SRT ZIP/JSON。', 'Explore public programs and local SRT records with explanations based on your profile.')}</p></header><Tabs label={l('项目查询方式', 'Opportunity search mode')} value={tab} onChange={setTab} items={[{id: 'catalog', label: l('项目库与推荐', 'Catalog & recommendations')}, {id: 'web', label: l('联网搜索', 'Web search')}]}/>
    {tab === 'web' ? <WebSearchPanel key={profile.userId} userId={profile.userId} api={api} initialQuery={q} purpose="opportunities"/> : <>
      <section className="op-filter"><form className="op-search" onSubmit={e => {e.preventDefault(); setPage(1); setParams({...input.trim() ? {q: input.trim()} : {}, ...projectType ? {type: projectType} : {}});}}><input aria-label={l('搜索科研项目', 'Search research projects')} value={input} onChange={e => setInput(e.target.value)} placeholder={l('研究方向、导师或学校，支持模糊搜索', 'Topic, mentor or institution; fuzzy search')}/><button className="btn btn-primary">{l('搜索', 'Search')}</button><button type="button" className="btn btn-outline" onClick={() => api.navigation.go('/app/settings?tab=sources')}>{l('导入 / 更新数据', 'Import / update data')}</button></form><div className="op-controls"><label>{l('项目类型', 'Project type')}<select aria-label={l('项目类型', 'Project type')} value={projectType} onChange={e => {setPage(1); const next = new URLSearchParams(params); if (e.target.value) next.set('type', e.target.value); else next.delete('type'); setParams(next);}}><option value="">{l('全部项目', 'All projects')}</option><option value="srt">{l('全部 SRT', 'All SRT')}</option><option value="teacher">{l('教师立项 SRT', 'Faculty initiated SRT')}</option><option value="student">{l('学生立项 SRT', 'Student initiated SRT')}</option></select></label><label>{l('排序', 'Sort')}<select value={mode} onChange={e => {setMode(e.target.value); setPage(1);}}><option value="recommend">{l('按我的画像推荐', 'Match my profile')}</option><option value="recent">{l('最近收录', 'Recently collected')}</option></select></label><label>{l('招募状态', 'Recruitment status')}<select value={status} onChange={e => {setStatus(e.target.value); setPage(1);}}><option value="">{l('全部', 'All')}</option><option value="open">{l('开放已核实', 'Verified open')}</option><option value="unknown">{l('待核实', 'Unverified')}</option><option value="closed">{l('已关闭', 'Closed')}</option><option value="upcoming">{l('即将开放', 'Upcoming')}</option></select></label>{mode === 'recommend' && <label className="service-check"><input type="checkbox" checked={hideConflicts} onChange={e => {setHideConflicts(e.target.checked); setPage(1);}}/>{l('隐藏已知资格冲突', 'Hide known eligibility conflicts')}</label>}</div></section>
      <p className="muted-hint">{l('匹配在本机计算，不是录取概率。公开项目线索不等于当前正在招募；请分别核对资格和开放状态。', 'Matching is computed locally and is not an admission probability. Check eligibility and current recruitment separately.')}</p>
      {error ? <div role="alert" className="form-error">{error}<button className="btn btn-outline" onClick={() => setRetry(x => x + 1)}>{l('重试', 'Retry')}</button></div> : busy ? <p role="status">{l('正在加载项目…', 'Loading projects…')}</p> : <><div className="op-result-count">{total} {l('条项目 / 计划 / 线索', 'projects / programs / leads')}</div>{!items.length && <p>{l('没有符合条件的记录。可以放宽筛选，或切换联网搜索。', 'No matching records. Broaden your filters or try web search.')}</p>}<div className="op-grid">{items.map(p => <article className="op-card" key={p.id}><div className="op-card-top"><Status p={p} l={l}/>{p.srt?.initiation_type && <span className="op-badge">{p.srt.initiation_type === 'teacher' ? l('教师立项 SRT', 'Faculty initiated SRT') : l('学生立项 SRT', 'Student initiated SRT')}</span>}<span>{p.visibility === 'private' ? l('我的本地资料', 'My local data') : l('公开来源', 'Public source')}</span></div><h2>{p.title}</h2><p className="op-meta">{p.institution || l('学校待核实', 'Institution unknown')} · {p.region || '—'}</p><p className="op-description">{p.description || l('暂无研究介绍，请查看原始来源。', 'No summary yet. See the source.')}</p><dl>{p.srt && <><dt>{l('项目编号', 'Project ID')}</dt><dd>{p.srt.project_id}</dd><dt>{l('立项人', 'Applicant')}</dt><dd>{p.srt.applicant || l('未提供', 'Not provided')}</dd></>}<dt>{l('周期', 'Duration')}</dt><dd>{(p.srt ? p.period_text.split('\n')[0] : p.period_text) || l('待核实', 'Unverified')}</dd><dt>{l('导师', 'Mentors')}</dt><dd>{p.mentors.join('、') || l('待核实', 'Unverified')}</dd></dl>{p.match && <div className="op-match"><strong>{l('匹配参考分', 'Match reference')} {p.match.score}</strong><p>{p.match.reasons.join('；') || l('暂无明确兴趣交集，可继续了解。', 'No clear overlap yet; explore the source.')}</p>{p.match.conflicts.length > 0 && <p className="op-conflict">{p.match.conflicts.join('；')}</p>}</div>}<div className="settings-actions"><button className="btn btn-primary" onClick={() => api.navigation.go(api.navigation.opportunityPath(p.id))}>{l('查看详情', 'View details')}</button><button className="btn btn-outline" aria-pressed={saved.includes(p.id)} onClick={() => void toggle(p.id)}>{saved.includes(p.id) ? l('已收藏', 'Saved') : l('收藏', 'Save')}</button><a href={p.source_url} target="_blank" rel="noreferrer">{l('原始来源 ↗', 'Source ↗')}</a></div></article>)}</div><div className="op-pagination"><button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>{l('上一页', 'Previous')}</button><span>{page} / {Math.max(1, Math.ceil(total / 12))}</span><button className="btn btn-outline" disabled={page * 12 >= total} onClick={() => setPage(p => p + 1)}>{l('下一页', 'Next')}</button></div></>}
    </>}
  </div>;
}
function Detail({profile, api}: ModulePageProps) {
  const {id} = useParams(); const l = labels(api); const [p, setProject] = useState<Project | null>(null); const [error, setError] = useState('');
  useEffect(() => {const c = new AbortController(); setProject(null); setError(''); void localRequest(profile.userId, '/api/projects/' + encodeURIComponent(id || ''), {signal: c.signal}).then(parseProject).then(x => {if (!c.signal.aborted) setProject(x);}).catch(e => {if (!c.signal.aborted) setError(e.message);}); return () => c.abort();}, [id, profile.userId]);
  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!p) return <p>{l('正在加载…', 'Loading…')}</p>;
  return <div className="op-detail"><button className="btn btn-outline" onClick={() => api.navigation.go('/app/opportunities')}>← {l('返回项目库', 'Back to projects')}</button><header className="op-heading"><p className="eyebrow">RESEARCH OPPORTUNITY</p><h1>{p.title}</h1><p>{p.institution} · {p.region}</p><Status p={p} l={l}/></header><div className="settings-grid">{[
    [l('研究内容', 'Research content'), p.description], [l('研究周期', 'Duration'), p.period_text],
    [l('导师信息', 'Mentors'), [p.mentors.join('、'), p.mentor_background].filter(Boolean).join('\n')], [l('项目组信息', 'Research team'), p.team],
    [l('申请资格', 'Eligibility'), p.eligibility_text], [l('申请方式', 'How to apply'), p.application_method],
  ].map(([title, text]) => <section className="settings-card" key={title}><h2>{title}</h2><p className="pre-line">{text || l('原始来源未提供，需进一步核实。', 'Not provided by the source; further verification is needed.')}</p></section>)}</div><SrtDetails p={p} api={api}/><section className="settings-card"><h2>{l('来源与核查', 'Sources & verification')}</h2><p>{l('收录日期：', 'Collected: ')}{p.collected_at}{p.deadline && ` · ${l('原始截止日期：', 'Source deadline: ')}${p.deadline}`}</p><a href={p.source_url} target="_blank" rel="noreferrer">{l('打开原始来源 ↗', 'Open source ↗')}</a>{p.warnings.map(x => <p key={x}>{x}</p>)}</section><div className="settings-actions">{p.application_url && <a className="btn btn-primary" href={p.application_url} target="_blank" rel="noreferrer">{l('官方申请入口', 'Official application')}</a>}<button className="btn btn-outline" onClick={() => api.navigation.go('/app/outreach?opportunityId=' + encodeURIComponent(p.id))}>{l('准备联系 / 资格询问邮件', 'Prepare an enquiry email')}</button><button className="btn btn-outline" onClick={() => api.navigation.go(p.contract.linkedFacultyIds?.length ? api.navigation.facultyPath(p.contract.linkedFacultyIds[0]) : '/app/faculty?q=' + encodeURIComponent(p.mentors[0] || p.institution))}>{l('查询导师资料', 'Look up mentors')}</button></div></div>;
}
function Root(props: ModulePageProps) { return <Routes><Route index element={<List key={props.profile.userId} {...props}/>}/><Route path=":id" element={<Detail key={props.profile.userId} {...props}/>}/></Routes>; }
const module: ResearchModule = {id: 'opportunities', contractVersion: CONTRACT_VERSION, title: '科研机会', summary: '公开科研项目、SRT 导入、个性化匹配与网络搜索。', icon: 'flask-conical', Root};
export default module;
