import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import type { ModulePageProps } from '@/sdk/contracts';
import { areas, explainMatch, statusLabels } from '../domain';
import type { FacultyEntry } from '../domain';
import { createFacultyClient } from '@/integrations/faculty';
import type { Shortlist } from '../useShortlist';
import { DateLabel, Empty, Evidence, Failure, Loading, SaveButton, StatusBadge, StorageNotice } from './shared';
import { WebSearchPanel } from '@/ui/WebSearchPanel';

export function SearchPage({ profile, api, shortlist }: ModulePageProps & { shortlist: Shortlist }) {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [input, setInput] = useState(q);
  const [entries, setEntries] = useState<FacultyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const mode = params.get('web') === '1' ? 'web' : params.get('data') === 'openalex' ? 'openalex' : params.get('data') === 'web' ? 'web' : 'local';
  const institution = params.get('institution') ?? '';
  const department = params.get('department') ?? '';
  const area = params.get('area') ?? '';
  const status = params.get('status') ?? '';
  const sort = params.get('sort') ?? 'relevance';
  const savedOnly = params.get('saved') === '1';
  const fuzzy = params.get('fuzzy') !== '0';
  const serverSort = (mode === 'local' || savedOnly) && sort !== 'match' ? sort : 'relevance';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const searchMode = params.get('search_mode') === 'name' ? 'name' : 'research';
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [institutions, setInstitutions] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [queryUsed, setQueryUsed] = useState('');
  const savedIds = Object.entries(shortlist.entries).filter(([, note]) => note.saved).map(([id]) => id).join(',');
  const client = useMemo(() => createFacultyClient(profile.userId), [profile.userId]);
  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    if (mode === 'web' || (mode === 'openalex' && !q.trim() && !savedOnly)) {setEntries([]); setTotal(0); setError(''); setLoading(false); return;}
    const controller = new AbortController();
    setLoading(true); setError(''); setEntries([]);
    const query = new URLSearchParams({q, source: savedOnly ? 'local' : mode, search_mode: searchMode, institution, department, area, status, fuzzy: String(fuzzy), page: String(page), page_size: '12', sort: serverSort});
    if (savedOnly) query.set('ids', savedIds);
    client.search(query, controller.signal).then(data => {
      if (!controller.signal.aborted) {setEntries(data.items); setTotal(data.total); setPageSize(data.page_size); setInstitutions(data.institutions); setDepartments(data.departments); setQueryUsed(data.query_used || '');}
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '资料暂时不可用，请重试。'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, mode, q, page, searchMode, institution, department, area, status, fuzzy, savedOnly, savedIds, serverSort, attempt]);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (key === 'data') {next.delete('web'); ['institution', 'department', 'area', 'status'].forEach(k => next.delete(k));}
    if (key !== 'page') next.delete('page');
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'institution') next.delete('department');
    setParams(next);
  }
  function submit(event: FormEvent) { event.preventDefault(); change('q', input.trim()); }
  function reset() { const next = new URLSearchParams(); next.set('data', mode); setParams(next); setInput(''); }
  const filtered = useMemo(() => entries.map(entry => ({entry, fit: explainMatch(entry, profile)}))
    .sort((a, b) => sort === 'match' ? (b.fit.score ?? -1) - (a.fit.score ?? -1) : mode === 'openalex' && sort === 'name' ? a.entry.faculty.name.localeCompare(b.entry.faculty.name) : mode === 'openalex' && sort === 'updated' ? Date.parse(b.entry.faculty.lastCheckedAt) - Date.parse(a.entry.faculty.lastCheckedAt) : 0), [entries, profile, sort, mode]);
  const modes = <div className="rsf-mode-row" aria-label="数据来源">{[['local', '清华导师数据库'], ['openalex', 'OpenAlex 学术搜索'], ['web', '公开网页搜索']].map(([id, label]) => <button key={id} className={mode === id ? 'is-active' : ''} aria-pressed={mode === id} onClick={() => change('data', id)}>{label}</button>)}</div>;
  const savedCount = Object.values(shortlist.entries).filter(note => note.saved).length;
  if (mode === 'web') return <>{modes}<WebSearchPanel key={profile.userId} userId={profile.userId} api={api} initialQuery={q} purpose="faculty"/></>;
  return <>
    <header className="rsf-heading"><div><p className="rsf-eyebrow">FACULTY / 从兴趣出发</p><h1>让研究兴趣，<br className="rsf-mobile" />找到具体的人。</h1><p>先了解他们在研究什么，再为一次有准备的交流找到起点。</p></div><div className="rsf-heading-mark" aria-hidden="true">✳</div></header>
    {modes}
    <p className="rsf-notice">{mode === 'local' ? '清华官网教师数据库 · 4,026 条来源资料记录。同一教师可能有多份介绍，未核实当前任职与招生。' : '只发送检索词至 OpenAlex。按研究主题从论文发现相关作者；按姓名查询作者记录。学术作者身份及当前任职需核实。'}</p>
    {mode === 'openalex' && <div className="rsf-mode-row"><label>检索方式 <select aria-label="OpenAlex 检索方式" value={searchMode} onChange={e => change('search_mode', e.target.value)}><option value="research">研究主题 → 论文与作者</option><option value="name">研究者姓名</option></select></label><button onClick={() => api.navigation.go('/app/settings?tab=search')}>配置 OpenAlex API</button></div>}
    <section className="rsf-search-panel" aria-label="搜索与筛选">
      <form className="rsf-search-form" onSubmit={submit}><label htmlFor="faculty-query">搜索导师、团队或研究问题</label><div className="rsf-search-input"><Search size={20} aria-hidden="true" /><input id="faculty-query" value={input} onChange={event => setInput(event.target.value)} maxLength={200} placeholder={mode === 'openalex' && searchMode === 'name' ? '例如：Geoffrey Hinton' : '姓名、院系或方向，例如：电气工程、machine learning'} /><button className="rsf-button rsf-primary" type="submit">搜索 <ArrowRight size={16} aria-hidden="true" /></button></div></form>
      <div className="rsf-examples"><span>从一个方向开始</span>{['大语言模型', '机器人', '蛋白质'].map(text => <button key={text} onClick={() => { setInput(text); change('q', text); }}>{text} ↗</button>)}</div>
      {mode === 'local' && <div className="rsf-filters"><label>学校<select aria-label="学校" value={institution} onChange={event => change('institution', event.target.value)}><option value="">全部学校</option>{institutions.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>院系<select aria-label="院系" value={department} onChange={event => change('department', event.target.value)}><option value="">全部院系</option>{departments.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>研究方向<select aria-label="研究方向" value={area} onChange={event => change('area', event.target.value)}><option value="">全部方向</option>{Object.entries(areas).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>招募状态<select aria-label="招募状态" value={status} onChange={event => change('status', event.target.value)}><option value="">全部状态</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>}
      <div className="rsf-filter-foot"><label className="rsf-check"><input type="checkbox" checked={savedOnly} onChange={event => change('saved', event.target.checked ? '1' : '')} />仅看收藏（{savedCount}）</label><label className="rsf-check"><input type="checkbox" checked={fuzzy} disabled={mode !== 'local'} onChange={e => change('fuzzy', e.target.checked ? '1' : '0')} />本地模糊搜索</label><button className="rsf-link-button" onClick={reset}>清除筛选</button></div>
    </section>
    <div className="rsf-profile-strip"><div><strong>依据你的当前画像，在本地解释匹配</strong><p>{profile.researchAreas.length ? profile.researchAreas.map(value => areas[value] ?? value).join(' · ') : '兴趣尚未确定，也可以先自由探索。'}{profile.interestKeywords.length ? ` · ${profile.interestKeywords.join('、')}` : ''}</p></div><button className="rsf-link-button" onClick={() => api.navigation.go('/app/profile')}>查看我的画像 ↗</button></div>
    <StorageNotice shortlist={shortlist} />
    <section aria-labelledby="faculty-results-title" aria-busy={loading}><div className="rsf-results-top"><div><p className="rsf-eyebrow">YOUR EXPLORATION</p><h2 id="faculty-results-title">值得进一步了解的方向 <span>{loading ? '…' : total} {mode === 'openalex' && searchMode === 'research' && !savedOnly ? '篇命中论文' : '条资料'}</span></h2></div><label className="rsf-sort"><SlidersHorizontal size={15} aria-hidden="true" /><span>排序</span><select aria-label="排序" value={sort} onChange={event => change('sort', event.target.value)}><option value="relevance">搜索相关度</option><option value="match">本页兴趣匹配</option><option value="updated">{mode === 'openalex' ? '本页资料日期' : '资料日期'}</option><option value="name">{mode === 'openalex' ? '本页姓名' : '姓名'}</option></select></label></div>
      {queryUsed && mode === 'openalex' && <p>实际检索词：{queryUsed} · 当前页展示 {filtered.length} 位相关作者</p>}
      <p className="rsf-result-note">匹配分仅供探索参考，不是录取预测。方向相关、申请资格和招募状态需要分别确认。</p>
      {loading ? <Loading /> : error ? <Failure message={error} retry={() => setAttempt(value => value + 1)} /> : !filtered.length ? <Empty title="还没有找到符合条件的记录" message={savedOnly ? '当前筛选下没有已收藏的导师，可以先浏览资料再加入候选清单。' : '试试姓名片段、中英文研究方向或放宽筛选。OpenAlex 需要先配置 API 并输入关键词。'}><button className="rsf-button rsf-secondary" onClick={reset}>清除筛选，重新探索</button></Empty> : <div className="rsf-grid">{filtered.map(({ entry, fit }) => {
        const faculty = entry.faculty;
        const paramsString = params.toString();
        return <article className="rsf-card" key={faculty.id}>
          <div className="rsf-card-top"><span className="rsf-avatar" aria-hidden="true">{faculty.name.match(/[A-Z]/)?.[0] ?? '研'}</span><div><span className="rsf-demo-label">{entry.metadata?.origin === 'openalex' ? 'OpenAlex 学术记录' : '清华官网资料'}</span><h3>{faculty.name}</h3></div><div className="rsf-score" aria-label={`兴趣参考分 ${fit.score ?? '暂未计算'}`}><strong>{fit.score ?? '—'}</strong><small>兴趣参考分</small></div></div>
          <p className="rsf-institution">{faculty.institution} · {faculty.department ?? '院系未知'}</p><div className="rsf-tags">{faculty.researchAreas.map(value => <span key={value}>{areas[value] ?? value}</span>)}</div><p className="rsf-summary">{faculty.researchSummary || '研究介绍尚未取得。'}</p>
          <div className="rsf-match"><strong>与你的兴趣有什么交集</strong><p>{fit.interest.length ? fit.interest.join('、') : fit.score === null ? '尚未填写兴趣，暂不评分；先从简介了解方向。' : '当前画像中暂无明确的领域或关键词交集，可以继续了解。'}</p></div>
          <StatusBadge faculty={faculty} /><div className="rsf-card-source"><span>资料取得日期：<DateLabel value={faculty.lastCheckedAt} /></span><Evidence sources={faculty.sources.slice(0, 1)} /></div>
          <div className="rsf-card-actions"><button className="rsf-button rsf-secondary" onClick={() => api.navigation.go(api.navigation.facultyPath(faculty.id) + (paramsString ? '?' + paramsString : ''))}>查看详情 <ArrowRight size={15} aria-hidden="true" /></button><SaveButton id={faculty.id} name={faculty.name} shortlist={shortlist} /></div>
        </article>;
      })}</div>}
      {!loading && !error && total > 0 && <div className="op-pagination"><button className="rsf-button rsf-secondary" disabled={page <= 1} onClick={() => change('page', String(page - 1))}>上一页</button><span>{page} / {Math.max(1, Math.ceil(total / pageSize))}</span><button className="rsf-button rsf-secondary" disabled={page * pageSize >= total || page >= 1000} onClick={() => change('page', String(page + 1))}>下一页</button></div>}
    </section><p className="rsf-bottom-note">全部匹配解释在本地生成，未调用 AI。成功率暂无可信数据，无法可靠估计。</p>
  </>;
}
