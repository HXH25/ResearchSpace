import type { DraftDocument, DraftPayload, EmailPlan, Language, OutreachOverrides } from '../types';
import { checkpoint } from './safety';
import { templateDraft } from './template';
import { validateDrafts } from './validate';

export async function generateTemplates(plan:EmailPlan,languages:Language[],overrides:OutreachOverrides={},signal?:AbortSignal):Promise<DraftPayload[]> {
  checkpoint(signal);
  const drafts=overrides.template ? await overrides.template.generate(plan,languages,signal) : languages.map(language=>templateDraft(plan,language));
  checkpoint(signal);
  const validate=overrides.validator?.validate.bind(overrides.validator)||validateDrafts;
  return validate(JSON.stringify({drafts}),plan,languages);
}
export function makeDocument(plan:EmailPlan,payload:DraftPayload,mode:DraftDocument['mode']):DraftDocument {
  const now=new Date().toISOString();
  return {schemaVersion:2,id:crypto.randomUUID(),ownerUserId:plan.ownerUserId,name:payload.subject.slice(0,120),createdAt:now,updatedAt:now,status:'draft',mode,edited:false,plan,payload};
}
