import type { DraftInput, DraftPayload, EmailPlan, Language, Paragraph } from '../types';
import { packs } from './locales';
import { buildPlan } from './plan';

export function templateDraft(plan: EmailPlan, language: Language): DraftPayload {
  const pack = packs[language];
  const text = (id:string) => {const f=plan.facts.find(f=>f.id===id);return (language==='en'?f?.english:f?.text)||'';};
  const paragraphs: Paragraph[]=[];
  const add=(value:string,ids:string[]=[])=>paragraphs.push({text:value,factIds:ids.filter(id=>plan.facts.some(f=>f.id===id))});
  add(pack.intro(plan.signature,text('student:institution'),text('student:year'),text('student:department')),['student:signature','student:institution','student:year','student:department']);
  const byKind=(kind:string)=>plan.facts.filter(f=>f.kind===kind);
  const phrase=(kind:string)=>(byKind(kind).map(f=>language==='en'?f.english:f.text).join(language==='zh-CN'||language==='ja'?'、':'; '));
  if (text('project:title')) add(pack.project(text('project:title')),['project:title']);
  if (text('student:followup')) add(pack.followup(text('student:followup')),['student:followup']);
  if (phrase('interest')) add(pack.interest(phrase('interest')),byKind('interest').map(f=>f.id));
  byKind('experience').slice(0,plan.length==='short'?1:2).forEach(f=>add(pack.experience(language==='en'?f.english:f.text),[f.id]));
  if (text('recipient:research')) add(pack.research(text('recipient:research')),['recipient:research']);
  const reading=byKind('reading')[0];
  if (reading?.readingLevel) add(pack.reading[reading.readingLevel](text(reading.id)),[reading.id]);
  const time=[text('student:hours')?pack.hours(text('student:hours')):'',text('student:start')?pack.start(text('student:start')):''].filter(Boolean).join(' ');
  if (time) add(time,['student:hours','student:start']);
  if (phrase('material')) add(pack.materials(phrase('material')),byKind('material').map(f=>f.id));
  add(pack.request[plan.purpose]+(plan.tone==='formal'?' '+pack.thanks:''));
  return {language,subject:`${pack.intent[plan.purpose]} — ${plan.signature}`.slice(0,180),salutation:pack.salutation(language==='en'?plan.recipientNameEnglish:plan.recipientName),paragraphs,closing:pack.closing,signature:plan.signature};
}
export function draftText(payload: DraftPayload): string {
  return [payload.salutation,...payload.paragraphs.map(p=>p.text),payload.closing,payload.signature].join('\n\n');
}
// Stable, pure public entry for host developers and template replacement.
export function buildEmailDraft(input: DraftInput, language: Language = 'zh-CN') {
  const plan=buildPlan(input);const payload=templateDraft(plan,language);
  return {subject:payload.subject,body:draftText(payload),attachmentSuggestions:plan.attachmentSuggestions,caveats:plan.caveats,payload,plan};
}
