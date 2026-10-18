import { useEffect, useState } from 'react';
import { useUiPreferences } from '@/app/preferences/store';
import { localRequest, type Source } from '@/integrations/client';

interface Job { id: string; source_id: string; status: string; error?: string; report?: {created: number; updated: number; errors: string[]}; progress?: {pages: number} }
export function DataSources({userId}: {userId: string}) {
  const {locale} = useUiPreferences(); const l = (zh: string, en: string) => locale === 'en' ? en : zh;
  const [sources, setSources] = useState<Source[]>([]); const [jobs, setJobs] = useState<Job[]>([]);
  const [database, setDatabase] = useState<{faculty_records: number; project_records: number; srt_records: number; srt_teacher: number; srt_student: number} | null>(null);
  const [query, setQuery] = useState(''); const [pages, setPages] = useState(2);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    void localRequest<{items: Source[]; database: {faculty_records: number; project_records: number; srt_records: number; srt_teacher: number; srt_student: number}}>(userId, '/api/sources', {signal: c.signal}).then(x => {if (!c.signal.aborted) {setSources(x.items); setDatabase(x.database);}}).catch(e => {if (!c.signal.aborted) setError(e.message);});
    const refresh = () => localRequest<{items: Job[]}>(userId, '/api/jobs', {signal: c.signal}).then(x => {if (!c.signal.aborted) setJobs(x.items);}).catch(e => {if (!c.signal.aborted) setError(e.message);});
    void refresh(); const timer = setInterval(() => void refresh(), 4000);
    return () => {c.abort(); clearInterval(timer);};
  }, [userId, notice]);
  async function collect(id: string) {
    setBusy(true); setError('');
    try {
      const job = await localRequest<Job>(userId, '/api/collect', {method: 'POST', body: JSON.stringify({source_id: id, query, max_pages: pages})});
      setJobs(j => [job, ...j.filter(x => x.id !== job.id)]); setNotice(l('采集任务已启动，可在下方查看进度。', 'Collection started. Progress appears below.'));
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function importFile(file: File) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (file.size > 20_000_000) throw new Error(l('文件不能超过20MB', 'Maximum file size is 20MB'));
      const result = await localRequest<{total: number}>(userId, '/api/import/srt', {method: 'POST', body: file, headers: {'Content-Type': 'application/octet-stream', 'X-Filename': file.name.endsWith('.zip') ? 'srt.zip' : 'srt.json'}});
      setNotice(l(`已导入 ${result.total} 条项目，仅当前本地账号可见。`, `Imported ${result.total} projects into this local account.`));
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function importJson(file: File) {
    setBusy(true); setError('');
    try {
      if (file.size > 20_000_000) throw new Error('File exceeds 20MB');
      const raw = JSON.parse(await file.text()) as unknown;
      const data = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && 'projects' in raw ? raw.projects : null;
      if (!Array.isArray(data)) throw new Error(l('需要项目数组或 {projects:[…]}', 'Expected an array or {projects:[…]}'));
      const result = await localRequest<{total: number}>(userId, '/api/import', {method: 'POST', body: JSON.stringify({projects: data})});
      setNotice(l(`已导入 ${result.total} 条项目。`, `Imported ${result.total} projects.`));
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <div className="settings-grid"><section className="settings-card wide-card"><span className="eyebrow">RESEARCH SOURCES</span>{database && <p className="notice-success">{l(`已连接数据库：${database.faculty_records} 条教师来源记录 · ${database.project_records} 条项目（SRT ${database.srt_records} 条：教师 ${database.srt_teacher} / 学生 ${database.srt_student}）。`, `Database connected: ${database.faculty_records} faculty source records · ${database.project_records} visible projects.`)}</p>}<h2>{l('科研数据源与 SRT', 'Research sources & SRT')}</h2><p>{l('下列官方采集入口不需要搜索 API key。已有项目库可离线检索；采集只在点击后运行。', 'These source collectors do not need a search API key. Browse existing records offline; collection runs only when requested.')}</p><div className="service-fields"><label>{l('采集关键词', 'Collection query')}<input value={query} onChange={e => setQuery(e.target.value)} placeholder="robotics / 机器学习"/></label><label>{l('每次最多页数', 'Maximum pages per run')}<input type="number" min={1} max={50} value={pages} onChange={e => setPages(Number(e.target.value))}/></label></div><div className="source-grid">{sources.map(s => <article className="source-card" key={s.id}><h3>{s.name}</h3><p>{s.coverage_note}</p><div className="settings-actions"><a href={s.documentation || s.urls?.[0] || s.endpoint} target="_blank" rel="noreferrer">{l('来源说明 ↗', 'Source details ↗')}</a><button className="btn btn-outline" disabled={busy || jobs.some(j => ['queued', 'running'].includes(j.status))} onClick={() => void collect(s.id)}>{l('采集 / 续传', 'Collect / resume')}</button></div></article>)}</div></section>
    <section className="settings-card wide-card"><h2>{l('导入项目与校内 SRT', 'Import projects and SRT data')}</h2><p>{l('公开版本不附带校内 SRT 项目数据。你可以通过下方入口导入自己有权限使用的标准项目 JSON 或 SRT ZIP；数据仅保存在当前本地账号中。', 'Import standard project JSON or an SRT ZIP containing project_details.json. Imported records stay private to the current account.')}</p><div className="settings-actions"><label className="btn btn-outline">{l('导入项目 JSON', 'Import project JSON')}<input disabled={busy} type="file" accept=".json" hidden onChange={e => {const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = '';}}/></label><label className="btn btn-outline">{l('导入 SRT ZIP / JSON', 'Import SRT ZIP / JSON')}<input disabled={busy} type="file" accept=".zip,.json" hidden onChange={e => {const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = '';}}/></label></div><p className="muted-hint">{l('SRT GitHub 仓库接口已预留：将仓库中的标准 JSON 下载后在此导入；数据格式见包内 project.template.json。', 'SRT GitHub integration uses the standard JSON import: download the repository data and import it here. See project.template.json for the format.')}</p></section>
    <section className="settings-card wide-card"><h2>{l('采集任务', 'Collection jobs')}</h2>{jobs.length === 0 && <p>{l('尚无采集任务。', 'No collection jobs yet.')}</p>}{jobs.slice(0, 10).map(j => <div className="job-row" key={j.id}><strong>{sources.find(s => s.id === j.source_id)?.name || j.source_id}</strong><span>{j.status}{j.progress ? ` · ${j.progress.pages} pages` : ''}</span>{j.report && <p>+{j.report.created} / {j.report.updated} {l('条更新', 'updated')}</p>}{(j.error || j.report?.errors.length) ? <details><summary>{l('查看诊断', 'View diagnostics')}</summary><pre>{j.error || j.report?.errors.join('\n')}</pre></details> : null}</div>)}</section>
    {notice && <p role="status" className="notice-success">{notice}</p>}{error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
