import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Mail } from 'lucide-react';
import type { ModulePageProps } from '@/sdk/contracts';
import { areas, explainMatch, opportunityStatus, relatedSchema } from '../domain';
import type { FacultyEntry } from '../domain';
import { createFacultyClient } from '@/integrations/faculty';
import { localRequest } from '@/integrations/client';
import { parseProjects } from '@/integrations/projects';
import { emptyNote } from '../useShortlist';
import type { CandidateNote, Shortlist } from '../useShortlist';
import { DateLabel, DemoNotice, Empty, Evidence, Failure, Loading, SaveButton, SourceLink, StatusBadge, StorageNotice } from './shared';

const roles = { faculty: '教师', postdoc: '博士后', phd: '博士生', masters: '硕士生', undergraduate: '本科生', alumni: '往届成员', other: '其他公开角色' };
const eligibilityLabels = { tsinghua_only: '限清华学生（仍需核对细则）', home_institution_only: '限主办高校学生', international_eligible: '国际学生可申请（需核对细则）', open_to_all: '公开申请（需核对其他条件）', unknown: '申请资格未知' };
type Related = ReturnType<typeof relatedSchema.parse>;

function PreparationNotes({ id, shortlist }: { id: string; shortlist: Shortlist }) {
  const [note, setNote] = useState<CandidateNote>(emptyNote);
  const [message, setMessage] = useState('');
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!shortlist.loading && !shortlist.error && !initialized) { setNote(shortlist.entries[id] ?? emptyNote); setInitialized(true); }
  }, [shortlist.loading, shortlist.error, shortlist.entries, id, initialized]);
  const persisted = shortlist.entries[id] ?? emptyNote;
  const dirty = note.questions !== persisted.questions || note.note !== persisted.note || note.preparation !== persisted.preparation;
  async function save() {
    setMessage('');
    if (await shortlist.update(id, { questions: note.questions, note: note.note, preparation: note.preparation })) setMessage('联系准备已保存到当前账户。');
  }
  return <section className="rsf-section" aria-labelledby="faculty-notes-heading"><p className="rsf-eyebrow">MY NEXT STEP</p><h2 id="faculty-notes-heading">把好奇，记成下一步</h2><p className="rsf-muted">只保存在当前本地账户。准备状态由你填写，不表示已经联系导师或发送邮件。</p>
    {!initialized && <p className="rsf-muted" role="status">正在读取当前账户的准备记录…</p>}
    <div className="rsf-note-fields"><label>待核查的问题<textarea disabled={!initialized || shortlist.loading} value={note.questions} maxLength={4000} onChange={event => { setNote({ ...note, questions: event.target.value }); setMessage(''); }} placeholder="例如：本科生可以从什么任务开始？目前是否有公开申请渠道？" /></label>
      <label>我的阅读与联系准备<textarea disabled={!initialized || shortlist.loading} value={note.note} maxLength={4000} onChange={event => { setNote({ ...note, note: event.target.value }); setMessage(''); }} placeholder="记录自己实际读过的资料、想补的基础和联系目的。" /></label></div>
    <div className="rsf-notes-actions"><label>准备状态<select aria-label="准备状态" disabled={!initialized || shortlist.loading} value={note.preparation} onChange={event => { setNote({ ...note, preparation: event.target.value as CandidateNote['preparation'] }); setMessage(''); }}><option value="exploring">初步了解</option><option value="reading">正在阅读与核查</option><option value="ready">已准备好联系材料</option></select></label><button className="rsf-button rsf-secondary" disabled={!initialized || shortlist.loading || shortlist.busy || Boolean(shortlist.error)} onClick={() => void save()}>保存准备记录</button><span className="rsf-muted" role="status">{initialized && (dirty ? '有未保存的修改' : message)}</span></div>
  </section>;
}

function RelatedProjects({ entry, api, userId }: { entry: FacultyEntry; api: ModulePageProps['api']; userId: string }) {
  const [items, setItems] = useState<Related | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search() {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setLoading(true); setError('');
    try {
      const result = entry.metadata?.srtProjectIds.length
        ? parseProjects(await localRequest(userId, '/api/faculty/' + encodeURIComponent(entry.faculty.id) + '/projects', {signal: request.signal})).items.map(p => p.contract)
        : await api.catalog.searchOpportunities({text: entry.keywords[0] || entry.faculty.name, limit: 12}, request.signal);
      if (!request.signal.aborted) setItems(relatedSchema.parse(result));
    } catch { if (!request.signal.aborted) setError('相关项目暂时无法读取，请稍后重试。'); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }
  return <section className="rsf-section"><p className="rsf-eyebrow">FOLLOW THE QUESTION</p><h2>沿着方向，寻找项目</h2><p className="rsf-muted">方向相近的项目不一定属于这位导师的团队。申请资格与招募状态分别展示，是否符合资格还需核对完整公告。</p><button className="rsf-button rsf-secondary" disabled={loading} onClick={() => void search()}>查找相关项目 <ArrowRight size={15} aria-hidden="true" /></button>
    {loading && <Loading label="正在读取科研项目模块…" />}{error && <Failure message={error} retry={() => void search()} />}
    {items && !loading && !error && (items.length ? <div className="rsf-related-list">{items.map(item => <article key={item.id}>
      {(item.isDemo || item.sources.some(source => source.type === 'mock')) && <strong className="rsf-demo-label">虚构演示 · 非真实机会</strong>}<h3>{item.title}</h3><p>{item.institution} · {item.linkedFacultyIds?.includes(entry.faculty.id) ? '记录明确关联该导师' : '方向相关 · 未确认属于该团队'}</p>
      <div className="rsf-tags"><span>资格：{eligibilityLabels[item.eligibility]}</span><span>状态：{opportunityStatus(item)}</span></div><Evidence sources={item.sources} />
      <button className="rsf-link-button" onClick={() => api.navigation.go(api.navigation.opportunityPath(item.id))}>查看项目与完整条件 ↗</button>
    </article>)}</div> : <p className="rsf-notice">暂未取得相关项目记录。科研项目模块可能尚未安装或暂无该方向的资料，不能据此判断是否存在机会。</p>)}
  </section>;
}

export function DetailPage({ profile, api, shortlist }: ModulePageProps & { shortlist: Shortlist }) {
  const { facultyId = '' } = useParams();
  const [params] = useSearchParams();
  const [entry, setEntry] = useState<FacultyEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setEntry(null);
    createFacultyClient(profile.userId).getEntry(facultyId, controller.signal).then(value => { if (!controller.signal.aborted) setEntry(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '资料无法读取。'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [facultyId, profile.userId, attempt]);
  useEffect(() => { if (!loading && entry) titleRef.current?.focus(); }, [loading, entry]);
  const back = () => api.navigation.go('/app/faculty' + (params.size ? '?' + params.toString() : ''));
  if (loading) return <Loading />;
  if (error) return <><button className="rsf-link-button" onClick={back}>返回搜索</button><Failure message={error} retry={() => setAttempt(value => value + 1)} /></>;
  if (!entry) return <Empty title="这份导师资料暂时不可用" message="资料可能尚未接入或编号已变更，请回到搜索页重新查找。"><button className="rsf-button rsf-secondary" onClick={back}>返回导师搜索</button></Empty>;
  const faculty = entry.faculty;
  const fit = explainMatch(entry, profile);
  return <>
    <button className="rsf-link-button rsf-back" onClick={back}><ArrowLeft size={16} aria-hidden="true" />返回搜索结果</button>
    {faculty.isDemo && <DemoNotice />}
    <header className="rsf-detail-heading"><div><p className="rsf-eyebrow">RESEARCHER / 导师资料</p><h1 ref={titleRef} tabIndex={-1}>{faculty.name}</h1><p>{faculty.institution} · {faculty.department ?? '院系信息未知'}</p><div className="rsf-tags">{faculty.researchAreas.map(area => <span key={area}>{areas[area] ?? area}</span>)}</div></div><SaveButton id={faculty.id} name={faculty.name} shortlist={shortlist} /></header>
    <StorageNotice shortlist={shortlist} />
    <div className="rsf-detail-layout"><div>
      <section className="rsf-section"><p className="rsf-eyebrow">01 / PUBLIC PROFILE</p><h2>研究背景与公开资料</h2><p>{faculty.researchSummary || '尚未取得研究介绍。'}</p><dl className="rsf-facts"><div><dt>官方主页</dt><dd>{faculty.officialPage ? <SourceLink url={faculty.officialPage} demo={faculty.isDemo}>查看主页</SourceLink> : '未知 / 未核实'}</dd></div><div><dt>公开联系邮箱</dt><dd>{faculty.publiclyListedContactEmail ?? '未知 / 未核实'}</dd></div><div><dt>资料取得日期</dt><dd><DateLabel value={faculty.lastCheckedAt} /></dd></div><div><dt>本科生参与资格</dt><dd>须以具体项目公告核实</dd></div></dl><Evidence sources={faculty.sources} ids={entry.factSourceIds.background} /></section>
      {entry.metadata && <section className="rsf-section"><h2>数据来源与信息边界</h2><p>{entry.metadata.note}</p>{entry.metadata.positions.length > 0 && <p>来源所列职称：{entry.metadata.positions.join('、')}</p>}{entry.metadata.listedBy.length > 0 && <p>发现资料的目录（不等于正式任职）：{entry.metadata.listedBy.join('、')}</p>}{entry.metadata.appointmentFlags.length > 0 && <p>任职背景标记：{entry.metadata.appointmentFlags.join('、')}</p>}{entry.metadata.evidence && <blockquote>{entry.metadata.evidence}</blockquote>}{entry.metadata.srtProjectIds.length > 0 && <p>历史 SRT 强关联项目编号：{entry.metadata.srtProjectIds.join('、')}。可在下方“查找相关项目”查看已接入的项目；当前是否仍招募需核实。</p>}</section>}
      <section className="rsf-section"><p className="rsf-eyebrow">02 / MATCH & PREPARATION</p><div className="rsf-section-heading"><h2>为什么值得你了解</h2><span className="rsf-large-score">{fit.score ?? '—'}<small> / 100 · 兴趣参考</small></span></div><p className="rsf-notice">本地规则解释 · 非录取预测。成功率暂无可信数据，无法可靠估计。</p>
        <h3>兴趣交集</h3><p>{fit.interest.length ? fit.interest.join('、') : '暂无明确交集；这并不表示该方向不适合你。'}</p><p className="rsf-muted">{fit.scoreExplanation}</p>
        <h3>已有准备与证据</h3><p>{fit.preparation.length ? fit.preparation.join('；') : '尚无与建议技能对应的自述记录，可以从阅读与小任务开始。'}</p>{fit.evidence.length > 0 && <ul className="rsf-list">{fit.evidence.map(text => <li key={text}>{text}</li>)}</ul>}<p className="rsf-muted">这里对照的是学习建议，不是导师公布的录取要求；经历描述由你填写，尚未独立核验。</p>
        <h3>参与偏好与时间</h3><p>{fit.work.length ? `可尝试与你偏好相符的活动：${fit.work.join('、')}。` : '尚未找到与当前工作偏好对应的建议活动。'}{fit.guidance}。</p><p>{fit.time}</p><p>指导信息：{faculty.dailyMentorship ? '有可引用资料，具体安排仍需本人确认。' : '不充分，尚无可核查的日常指导安排。'}</p>
        <h3>还需要确认</h3><ul className="rsf-list">{fit.unknowns.map(text => <li key={text}>{text}</li>)}</ul><div className="rsf-task"><BookOpen size={20} aria-hidden="true" /><div><strong>先试一件小事 · 系统学习建议</strong><p>{fit.task}</p></div></div><p className="rsf-muted">参考画像字段：{fit.usedFields.join('、')}。当前解释在本地生成，未调用 AI。</p>
      </section>
      <section className="rsf-section"><p className="rsf-eyebrow">03 / SELECTED WORKS</p><h2>代表性论文与阅读起点</h2>{faculty.selectedWorks?.length ? <ul className="rsf-works">{faculty.selectedWorks.map((work, index) => <li key={`${work.title}:${index}`}><span>{work.year ?? '年份未知'}</span><SourceLink url={work.url} demo={faculty.isDemo}>{work.title}</SourceLink></li>)}</ul> : <p className="rsf-muted">未取得有来源支持的代表作品，暂不生成论文方法或结论。</p>}<Evidence sources={faculty.sources} ids={entry.factSourceIds.works} /></section>
      <section className="rsf-section"><p className="rsf-eyebrow">04 / TEAM & PARTICIPATION</p><h2>团队与本科生参与</h2><h3>{faculty.groupName ?? '课题组名称未知 / 未核实'}</h3>{faculty.groupPage && <SourceLink url={faculty.groupPage} demo={faculty.isDemo}>公开课题组页面</SourceLink>}
        {faculty.teamMembers?.length ? <ul className="rsf-team">{faculty.teamMembers.map((member, index) => <li key={`${member.name}:${index}`}><strong>{member.name}</strong><span>{roles[member.role]}</span>{member.researchInterests?.length ? <p>{member.researchInterests.join('、')}</p> : null}{member.publicPageUrl && <SourceLink url={member.publicPageUrl} demo={faculty.isDemo}>公开学术主页</SourceLink>}<Evidence sources={faculty.sources} ids={member.sourceIds} /></li>)}</ul> : <p className="rsf-muted">未取得公开成员名单，不从论文共同署名推断指导关系。</p>}
        <h3>本科生参与记录</h3><p>{faculty.undergraduateParticipation ?? '未知 / 未取得可核查案例；这不表示本科生不能参与。'}</p><Evidence sources={faculty.sources} ids={entry.factSourceIds.participation} /><h3>日常指导安排</h3><p>{faculty.dailyMentorship ?? '未知 / 未核实，请直接询问具体任务、反馈频率与日常指导者。'}</p><Evidence sources={faculty.sources} ids={entry.factSourceIds.mentorship} />
      </section>
      <section className="rsf-section"><p className="rsf-eyebrow">05 / PUBLIC TALKS</p><h2>公开报告与视频索引</h2>{entry.media.length ? entry.media.map((item, index) => <article className="rsf-media" key={`${item.url}:${index}`}><h3><SourceLink url={item.url} demo={faculty.isDemo}>{item.title}</SourceLink></h3><p>{item.publisher} · <DateLabel value={item.publishedAt} /></p><p>主题：{item.topic}</p><Evidence sources={faculty.sources} ids={item.sourceIds} /></article>) : <p className="rsf-muted">暂未取得可信的公开视频或报告来源。</p>}<p className="rsf-muted">未取得有权限使用的字幕或文稿，当前只展示索引，不生成内容摘要或指导风格判断。</p></section>
      <RelatedProjects key={'projects:' + faculty.id} entry={entry} api={api} userId={profile.userId} />
      <PreparationNotes key={'notes:' + faculty.id} id={faculty.id} shortlist={shortlist} />
    </div><aside className="rsf-detail-aside"><section className="rsf-section rsf-next-step"><p className="rsf-eyebrow">BEFORE YOU REACH OUT</p><h2>先核实，再联系</h2><StatusBadge faculty={faculty} /><p>研究方向相关，不代表当前有名额或你已满足申请资格。</p><p className="rsf-muted">招募核验日期：<DateLabel value={faculty.recruitmentVerifiedAt} />。资料读取日期与招募核验日期分别记录。</p><Evidence sources={faculty.sources} ids={entry.factSourceIds.recruitment} /><div className="rsf-aside-actions"><button className="rsf-button rsf-primary" onClick={() => api.navigation.go('/app/outreach?facultyId=' + encodeURIComponent(faculty.id))}><Mail size={16} aria-hidden="true" />准备联系邮件</button><button className="rsf-link-button" onClick={() => api.navigation.go('/app/opportunities?q=' + encodeURIComponent(faculty.researchAreas.map(area => areas[area] ?? area).join(' ')))}>浏览科研机会 <ExternalLink size={14} aria-hidden="true" /></button></div><p className="rsf-muted">准备联系前，请核实对方身份与公开渠道，并确认自己实际阅读过哪些资料。</p></section></aside></div>
  </>;
}
