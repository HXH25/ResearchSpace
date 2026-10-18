/** Integration examples only. Nothing in this file runs automatically. */
import type { OutreachOverrides, SearchPort, FetchPort } from '../types';
import { createJsonResearchProxy } from '../providers/jsonResearchProxy';
import { buildPlan } from '../core/plan';
import { validateDrafts } from '../core/validate';
import { templateDraft } from '../core/template';

// In module.tsx, use createOutreachModule(publicGatewayOverrides()) only after a
// trusted same-origin public-data gateway has been configured by the host owner.
export function publicGatewayOverrides():OutreachOverrides {
  return createJsonResearchProxy('/api/public-research');
}
// Or inject an independently implemented search/fetch provider without changing
// any planner, validator, UI component, frozen SDK type or local account code.
export function customPublicData(search:SearchPort,fetch:FetchPort):OutreachOverrides {return {search,fetch};}

export const explicitDefaultCore:OutreachOverrides={
  planner:{plan:buildPlan},
  validator:{validate:validateDrafts},
  template:{async generate(plan,languages,signal){signal?.throwIfAborted();return languages.map(l=>templateDraft(plan,l));}},
};
