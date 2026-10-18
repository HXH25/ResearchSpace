import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react';
import { AppearanceControls } from '@/app/components/AppearanceControls';
import { ServiceSettings } from '@/app/components/ServiceSettings';
import { DataSources } from '@/app/components/DataSources';
import { useUiPreferences } from '@/app/preferences/store';
import { PageHeading, Pill } from '@/ui/components';
import { Tabs } from '@/ui/Tabs';
import { exportBackup, parseBackup, restoreBackup, deleteAccount } from '@/app/services/db';
import { installedCount, installedModules, moduleLoadErrors, moduleSlots } from '@/app/services/modules';
import { localRequest } from '@/integrations/client';
import { translate as t } from '@/app/i18n';

export function Settings({userId, onDeleted, onReload}: {userId: string; onDeleted: () => Promise<void>; onReload: () => void}) {
  const {locale} = useUiPreferences(); const l = (zh: string, en: string) => locale === 'en' ? en : zh;
  const input = useRef<HTMLInputElement>(null); const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const allowed = ['ai', 'search', 'sources', 'appearance', 'data'];
  const tab = allowed.includes(params.get('tab') || '') ? params.get('tab')! : 'ai';
  const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function exportData() {
    try {
      const backup = await exportBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'}));
      const a = document.createElement('a'); a.href = url; a.download = `researchspace-local-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus(l('画像与模块数据已导出，不包含服务商密钥。', 'Profile and module data exported; provider keys are excluded.'));
    } catch (e) {setError((e as Error).message);}
  }
  async function importData(file: File) {
    setError(''); setStatus('');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error(l('备份文件不能超过5MB', 'Backup must be under 5MB'));
      const parsed = parseBackup(JSON.parse(await file.text()));
      if (!window.confirm(l(`将替换当前浏览器中的全部本地账户数据，导入 ${parsed.accounts.length} 个账户。继续？`, `Replace all browser account data with ${parsed.accounts.length} imported accounts?`))) return;
      setBusy(true); await restoreBackup(parsed); onReload();
    } catch (e) {setError((e as Error).message);}
    finally {setBusy(false); if (input.current) input.current.value = '';}
  }
  async function removeMe() {
    if (!window.confirm(l('确定删除当前账户、画像、模块数据与本地服务配置？此操作不可撤销。', 'Delete this account, profile, module data and local service settings? This cannot be undone.'))) return;
    setBusy(true); setError('');
    try {
      await localRequest(userId, '/api/account', {method: 'DELETE'});
      await deleteAccount(userId); await onDeleted(); navigate('/welcome');
    } catch (e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <div className="settings-page"><PageHeading eyebrow="PREFERENCES & CONNECTIONS" title={l('设置你的科研空间', 'Make ResearchSpace yours')} description={l('自己的模型、自己的搜索，和适合你的界面。', 'Your models, your search providers, your interface.')}/>
    <Tabs label={l('设置分类', 'Settings sections')} value={tab} onChange={id => setParams({tab: id})} items={[
      {id: 'ai', label: l('AI 服务', 'AI services')}, {id: 'search', label: l('搜索服务', 'Search services')}, {id: 'sources', label: l('数据源与 SRT', 'Sources & SRT')}, {id: 'appearance', label: l('外观与语言', 'Appearance & language')}, {id: 'data', label: l('数据与模块', 'Data & modules')},
    ]}/>
    <div role="tabpanel" aria-label={tab}>
      {(tab === 'ai' || tab === 'search') && <ServiceSettings key={`${userId}:${tab}`} userId={userId} kind={tab}/>}
      {tab === 'sources' && <DataSources key={userId} userId={userId}/>}
      {tab === 'appearance' && <section className="settings-card wide-card"><h2>{l('外观与语言', 'Appearance & language')}</h2><p>{l('选择主题颜色和界面语言。字体优先使用微软雅黑。', 'Choose your theme and interface language. Microsoft YaHei is the preferred font.')}</p><AppearanceControls expanded/></section>}
      {tab === 'data' && <div className="settings-grid"><section className="settings-card wide-card"><h2>{l('本地账户与数据', 'Local account & data')}</h2><p>{l('画像、收藏和草稿保存在当前浏览器。API 设置与导入项目由本机 Python 服务按账号隔离保存。', 'Profiles, saved items and drafts are stored in this browser. API settings and imported projects are isolated by account in the local Python service.')}</p><div className="settings-actions"><button disabled={busy} className="btn btn-outline" onClick={() => void exportData()}><ArrowDownToLine size={16}/>{l('导出全部画像与草稿', 'Export profiles & drafts')}</button><button disabled={busy} className="btn btn-outline" onClick={() => input.current?.click()}><ArrowUpFromLine size={16}/>{l('导入备份', 'Import backup')}</button><input ref={input} type="file" hidden accept=".json" onChange={e => {const f = e.target.files?.[0]; if (f) void importData(f);}}/></div><p className="muted-hint">{l('导出文件包含个人资料，请妥善保存。换浏览器导入后，需要重新配置 API key；不会从其他浏览器读取服务密钥。', 'Backups contain personal information. After importing into a new browser, configure API keys again.')}</p><button disabled={busy} className="danger-link" onClick={() => void removeMe()}><Trash2 size={16}/>{l('删除当前本地账户', 'Delete this local account')}</button></section>
        <section className="settings-card wide-card"><h2>{l('功能模块', 'Modules')} <Pill tone="blue">{installedCount} / {moduleSlots.length}</Pill></h2><div className="module-status-list">{moduleSlots.map(slot => <div className="module-status-row" key={slot.id}><strong>{t(slot.title)}</strong><Pill tone={installedModules[slot.id] ? 'green' : 'gray'}>{installedModules[slot.id] ? l('已接入', 'Installed') : l('尚未提供', 'Not supplied')}</Pill></div>)}</div>{moduleLoadErrors.length > 0 && <p role="alert">{moduleLoadErrors.join('\n')}</p>}</section>
      </div>}
    </div>{status && <p role="status" className="notice-success">{status}</p>}{error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
