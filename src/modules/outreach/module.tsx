import { useLocation } from 'react-router-dom';
import type { ModulePageProps, ResearchModule } from '@/sdk/contracts';
import { CONTRACT_VERSION } from '@/sdk/contracts';
import type { OutreachOverrides } from './types';
import { OutreachWorkspace } from './components/OutreachWorkspace';
import './styles.css';
import { localRequest, type SearchResponse } from '@/integrations/client';
import type { FetchedPage } from './types';

/** Replace individual ports here without changing the frozen host contract. */
export function createOutreachModule(overrides:OutreachOverrides={}, localGateway=false):ResearchModule {
  function Root({profile,api}:ModulePageProps) {
    const {search}=useLocation();
    // Reset editor, consent and pending requests together on account/profile/target
    // changes. Saved drafts remain in the host's isolated storage namespace.
    const connected: OutreachOverrides = localGateway ? {
      search: {async search(query, signal) {const data = await localRequest<SearchResponse>(profile.userId, '/api/search', {method:'POST', body:JSON.stringify({query, limit:8}), signal}); return data.results;}},
      fetch: {async fetch(url, signal) {return localRequest<FetchedPage>(profile.userId, '/api/research', {method:'POST', body:JSON.stringify({operation:'fetch',url}), signal});}},
      ...overrides,
    } : overrides;
    return <OutreachWorkspace key={`${profile.userId}:${profile.updatedAt}:${search}`} profile={profile} api={api} overrides={connected} search={search}/>;
  }
  return {id:'outreach',contractVersion:CONTRACT_VERSION,title:'科研联系邮件',summary:'基于已确认事实生成、编辑和保存多语言科研邮件草稿。',icon:'mail',Root};
}
const outreachModule=createOutreachModule({}, true);
export default outreachModule;
