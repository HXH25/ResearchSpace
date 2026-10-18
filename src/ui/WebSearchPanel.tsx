import { useEffect, useRef, useState } from 'react';
import type { HostApi } from '@/sdk/contracts';
import { useUiPreferences } from '@/app/preferences/store';
import { localRequest, type SearchHit, type SearchResponse } from '@/integrations/client';

export function WebSearchPanel({userId, api, initialQuery = '', purpose}: {userId: string; api: HostApi; initialQuery?: string; purpose: 'faculty' | 'opportunities'}) {
  const {locale} = useUiPreferences(); const l = (zh: string, en: string) => locale === 'en' ? en : zh;
  const [provider, setProvider] = useState('');
  const [query, setQuery] = useState(initialQuery); const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [saving, setSaving] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  async function search() {
    controller.current?.abort(); const c = new AbortController(); controller.current = c;
    setBusy(true); setError(''); setResult(null);
    try {const value = await localRequest<SearchResponse>(userId, '/api/search', {method: 'POST', body: JSON.stringify({query, ...(provider ? {provider} : {})}), signal: c.signal}); if (!c.signal.aborted) setResult(value);}
    catch (e) {if (!c.signal.aborted) setError((e as Error).message);}
    finally {if (!c.signal.aborted) setBusy(false);}
  }
  async function save(hit: SearchHit) {
    setSaving(hit.url); setError('');
    try {
      await localRequest(userId, '/api/import', {method: 'POST', body: JSON.stringify({projects: [{source_id: result?.provider === 'openalex' ? 'openalex' : 'web_search', source_record_id: hit.url, source_url: hit.url, title: hit.title, description: hit.snippet, kind: 'lead', status: 'unknown', reviewed: false, warnings: ['搜索摘要仅为线索；资格、导师、周期与申请方式须人工核实。']} ]})});
      api.navigation.go('/app/opportunities?q=' + encodeURIComponent(hit.title));
    } catch (e) {setError((e as Error).message);} finally {setSaving('');}
  }
  return <section className="web-search-panel"><h2>{purpose === 'faculty' ? l('搜索公开导师资料', 'Search public faculty information') : l('搜索公开科研机会', 'Search public research opportunities')}</h2><p>{l('仅发送下面的检索词给已配置的搜索服务。搜索结果是待核查线索，请打开来源确认。', 'Only the query below is sent to your configured search provider. Results are leads; verify the source before relying on them.')}</p><form onSubmit={e => {e.preventDefault(); void search();}} className="op-search"><select aria-label={l('搜索服务', 'Search provider')} value={provider} onChange={e => {controller.current?.abort(); setBusy(false); setProvider(e.target.value); setResult(null); setError('');}}><option value="">{l('使用设置中的默认服务', 'Configured default')}</option><option value="openalex">OpenAlex · {l('学术论文线索', 'Academic leads')}</option></select><input aria-label={l('联网搜索关键词', 'Web search query')} value={query} onChange={e => setQuery(e.target.value)} placeholder={purpose === 'faculty' ? '姓名 + 学校 / name + institution' : 'undergraduate summer research'} maxLength={500}/><button className="btn btn-primary" disabled={busy || !query.trim()}>{busy ? l('搜索中…', 'Searching…') : l('联网搜索', 'Search the web')}</button><button type="button" className="btn btn-outline" onClick={() => api.navigation.go('/app/settings?tab=search')}>{l('配置搜索 API', 'Search API settings')}</button></form>
    {error && <p role="alert" className="form-error">{error}</p>}{result?.provider === 'openalex' && <p className="muted-hint">{l('OpenAlex 返回学术论文线索，不代表正在招募的科研项目。', 'OpenAlex returns scholarly works, not confirmed research openings.')}</p>}{result && <p role="status">{result.provider} · {result.results.length} {l('条结果', 'results')}</p>}{result && result.results.length === 0 && <p>{l('没有找到结果，试试其他关键词。', 'No results. Try another query.')}</p>}
    <div className="source-grid">{result?.results.map(hit => <article className="source-card" key={hit.url}><h3><a href={hit.url} target="_blank" rel="noreferrer">{hit.title} ↗</a></h3><small className="source-url">{hit.url}</small><p>{hit.snippet}</p>{purpose === 'opportunities' ? <button disabled={Boolean(saving)} className="btn btn-outline" onClick={() => void save(hit)}>{saving === hit.url ? l('保存中…', 'Saving…') : l('保存为待核查项目线索', 'Save as a research lead')}</button> : <button className="btn btn-outline" onClick={() => api.navigation.go('/app/outreach')}>{l('准备联系邮件', 'Prepare an email')}</button>}</article>)}</div>
  </section>;
}
