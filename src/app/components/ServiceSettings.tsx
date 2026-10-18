import { useEffect, useState } from 'react';
import { Check, ExternalLink, KeyRound, LoaderCircle, PlugZap, Trash2 } from 'lucide-react';
import { useUiPreferences } from '@/app/preferences/store';
import { Tabs } from '@/ui/Tabs';
import { localRequest, settingsChanged, type Presets, type ServiceConfig, type ServiceKind, type ServiceSettings as Settings } from '@/integrations/client';

type Draft = ServiceConfig & {api_key: string};
export function ServiceSettings({userId, kind}: {userId: string; kind: ServiceKind}) {
  const {locale} = useUiPreferences(); const l = (zh: string, en: string) => locale === 'en' ? en : zh;
  const [presets, setPresets] = useState<Presets | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [showKey, setShowKey] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void Promise.all([localRequest<Presets>(userId, '/api/presets', {signal: controller.signal}), localRequest<Settings>(userId, '/api/settings', {signal: controller.signal})]).then(([p, s]) => {
      if (controller.signal.aborted) return;
      setPresets(p); setSettings(s); setSelected(s.active[kind]); setDrafts({});
    }).catch(e => {if (!controller.signal.aborted) setError(e.message);});
    return () => controller.abort();
  }, [userId, kind, retry]);
  const preset = presets?.[kind].find(p => p.id === selected);
  const saved = settings?.[kind][selected];
  const draft: Draft | undefined = drafts[selected] ?? (saved ? {...saved, api_key: ''} : undefined);
  function patch(value: Partial<Draft>) { if (draft) setDrafts(d => ({...d, [selected]: {...draft, ...value}})); setNotice(''); }
  async function action(mode: 'save' | 'activate' | 'test' | 'clear') {
    if (!draft) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const path = `/api/settings/${kind}/${selected}`;
      if (mode === 'test') {
        await localRequest(userId, path + '/test', {method: 'POST'});
        setNotice(l('连接测试通过。', 'Connection test passed.'));
      } else {
        const body = {base_url: draft.base_url, persist_key: draft.persist_key,
          ...(kind === 'ai' ? {model: draft.model, max_tokens: draft.max_tokens} : {max_results: draft.max_results}),
          ...(draft.api_key.trim() ? {api_key: draft.api_key.trim()} : {}), make_active: mode === 'activate'};
        const data = await localRequest<Settings>(userId, path + (mode === 'clear' ? '/key' : ''), {method: mode === 'clear' ? 'DELETE' : 'PUT', ...(mode === 'clear' ? {} : {body: JSON.stringify(body)})});
        setSettings(data); setDrafts(values => {const copy = {...values}; delete copy[selected]; return copy;});
        setShowKey(false); settingsChanged(userId);
        setNotice(mode === 'clear' ? l('该服务的密钥已清除。', 'The provider key was removed.') : mode === 'activate' ? l('已保存并设为默认服务。', 'Saved and set as the default provider.') : l('配置已保存。', 'Settings saved.'));
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  if (!settings || !presets || !draft || !preset) return <section className="settings-card wide-card">{error ? <><p role="alert">{error}</p><button className="btn btn-outline" onClick={() => setRetry(v => v + 1)}>{l('重新连接', 'Retry connection')}</button></> : <p>{l('正在读取服务配置…', 'Loading service settings…')}</p>}</section>;
  const dirty = Boolean(drafts[selected]);
  return <section className="settings-card wide-card services-card">
    <div className="service-intro"><div><span className="eyebrow">{kind === 'ai' ? 'YOUR AI PROVIDER' : 'YOUR SEARCH PROVIDER'}</span><h2>{kind === 'ai' ? l('选择你的 AI 服务', 'Choose your AI provider') : l('选择你的搜索服务', 'Choose your search provider')}</h2><p>{kind === 'ai' ? l('用于邮件润色与生成。选择服务后填写自己的密钥，模型 ID 可以手动修改。', 'Used for email drafting. Add your own key and edit the model ID as needed.') : l('OpenAlex 用于论文与研究者检索；其他服务用于网页和招募公告。导师数据库的本地搜索无需 API。', 'Used to search public faculty information and research opportunities. One provider is enough.')}</p></div><span className="service-default"><Check size={14}/>{l('当前默认：', 'Default: ')}{presets[kind].find(p => p.id === settings.active[kind])?.name}</span></div>
    <Tabs label={l('服务商选项卡', 'Provider tabs')} items={presets[kind].map(p => ({id: p.id, label: p.name}))} value={selected} onChange={id => {if (!busy) {setSelected(id); setShowKey(false); setNotice(''); setError('');}}}/>
    <div role="tabpanel" aria-label={preset.name} className="service-panel">
      <div className="service-panel-title"><KeyRound size={22}/><h3>{preset.name}</h3><span className={`key-status ${saved?.has_key ? 'configured' : ''}`}>{saved?.has_key ? l('已保存密钥', 'Key saved') : preset.key_optional ? l('本地服务可不填密钥', 'Key optional for local service') : l('待填写密钥', 'Key required')}</span>{preset.docs && <a href={preset.docs} target="_blank" rel="noreferrer">{l('官方文档', 'Provider docs')}<ExternalLink size={14}/></a>}</div>
      {selected === 'openalex' && <p className="muted-hint">{l('填写 OpenAlex API Key，地址保持 https://api.openalex.org。保存后可在导师探索选择 OpenAlex，也可设为科研机会联网搜索的默认服务。', 'Enter your OpenAlex API key and keep https://api.openalex.org. Save to enable faculty search, or select it as the default for academic leads.')}</p>}
      <fieldset disabled={busy} className="service-fields">
        <label className="full">API Key<div className="key-input"><input aria-label={`${preset.name} API Key`} type={showKey ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} value={draft.api_key} onChange={e => patch({api_key: e.target.value})} placeholder={saved?.has_key ? l('留空保留现有密钥；输入新密钥即可替换', 'Leave blank to keep the saved key') : l('输入你自己的 API Key', 'Enter your own API key')}/><button type="button" onClick={() => setShowKey(v => !v)}>{showKey ? l('隐藏', 'Hide') : l('显示', 'Show')}</button></div><small>{l('已保存的密钥不会回显，也不会包含在个人资料 JSON 备份中。', 'Saved keys are never returned to the page or included in profile JSON backups.')}</small></label>
        <label className="full">{kind === 'ai' ? 'Base URL' : l('搜索 API 地址', 'Search endpoint')}<input aria-label="Base URL" type="url" value={draft.base_url} onChange={e => patch({base_url: e.target.value})}/></label>
        {kind === 'ai' ? <><label>{l('模型 ID', 'Model ID')}<input aria-label="Model ID" list={`models-${selected}`} value={draft.model || ''} onChange={e => patch({model: e.target.value})} placeholder={l('填写此服务可用的模型名称', 'Enter an available model name')}/><datalist id={`models-${selected}`}>{preset.models?.map(m => <option key={m} value={m}/>)}</datalist></label><label>Max tokens<input aria-label="Max tokens" type="number" min={64} max={32768} value={draft.max_tokens} onChange={e => patch({max_tokens: Number(e.target.value)})}/></label></> : <label>{l('每次搜索结果数', 'Results per search')}<input type="number" min={1} max={20} value={draft.max_results} onChange={e => patch({max_results: Number(e.target.value)})}/></label>}
        <label className="service-check full"><input type="checkbox" checked={draft.persist_key} onChange={e => patch({persist_key: e.target.checked})}/>{l('在本机加密保存密钥，重启服务后继续使用', 'Retain the key encrypted on this computer after server restart')}</label>
      </fieldset>
      <p className="muted-hint">{draft.persist_key ? l('仅用于本机保管；加密文件和解密密钥都在本机，请勿分享运行数据目录。', 'The encrypted key and its local decryption key stay on this computer. Do not share the runtime data directory.') : l('默认仅在本次 Python 服务进程中保留密钥，关闭服务后需重新输入。', 'By default the key stays in server memory only. Re-enter it after restarting Python.')}</p>
      <div className="settings-actions"><button disabled={busy} className="btn btn-primary" onClick={() => void action('activate')}>{busy ? <LoaderCircle size={16} className="spin"/> : <Check size={16}/>} {l('保存并设为默认', 'Save as default')}</button><button disabled={busy} className="btn btn-outline" onClick={() => void action('save')}>{l('仅保存', 'Save only')}</button><button disabled={busy || dirty || !saved?.ready} title={dirty ? l('请先保存修改', 'Save changes first') : undefined} className="btn btn-outline" onClick={() => void action('test')}><PlugZap size={16}/>{l('测试连接', 'Test connection')}</button><button disabled={busy || !saved?.has_key} className="danger-link" onClick={() => void action('clear')}><Trash2 size={15}/>{l('清除密钥', 'Remove key')}</button></div>
      <p className="muted-hint">{l('测试连接会发送一个极小请求，可能消耗服务商额度；保存配置本身不会调用外部服务。', 'Testing sends a small request and may use provider credits. Saving settings does not contact the provider.')}{dirty && ` ${l('有未保存的修改，请先保存再测试。', 'Save your changes before testing.')}`}</p>
      {notice && <p className="notice-success" role="status">{notice}</p>}{error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>;
}
