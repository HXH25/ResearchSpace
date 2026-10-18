import { describe, expect, it } from 'vitest';
import { input, opportunity, handoff } from './fixtures';
import { LANGUAGES } from '../types';
import { buildPlan } from '../core/plan';
import { buildEmailDraft, draftText, templateDraft } from '../core/template';
import { generateTemplates } from '../core/service';
import { checkContact, parseHandoff } from '../core/handoff';
import { strictJson, validateDrafts } from '../core/validate';
import { createHandoffEnvelope } from '../examples/handoffEnvelope';

describe('offline planning and multilingual drafts',()=>{
  it.each(LANGUAGES)('produces a valid grounded %s draft without network',async language=>{
    const i=input();i.reading={title:'Visual Learning',level:'abstract',confirmed:true};i.materials=['CV'];
    const plan=buildPlan(i);const [draft]=await generateTemplates(plan,[language]);
    expect(draft.language).toBe(language);expect(draft.signature).toBe(i.signature);expect(draft.paragraphs.length).toBeGreaterThan(4);
    expect(draftText(draft)).not.toMatch(/TODO|undefined|NaN/);expect(plan.facts.find(f=>f.id==='student:hours')?.text).toBe('0');
  });
  it('uses only selected facts and preserves input immutability',()=>{
    const i=input();i.selectedProfileIds=['student:keyword:0'];const original=structuredClone(i);const {body,plan}=buildEmailDraft(i,'en');
    expect(body).not.toContain('Example University');expect(body).not.toContain('course project');expect(body).toContain('machine learning');
    expect(plan.facts.map(f=>f.id)).toEqual(['student:keyword:0','student:signature','recipient:research']);expect(i).toEqual(original);
  });
  it('supports empty optional profile and manual recipient with no email',()=>{
    const i=input();i.faculty=null;i.manual.email='';i.manual.researchSummary='';i.selectedProfileIds=[];
    const result=buildEmailDraft(i,'en');expect(result.body).toContain('May I ask');expect(result.plan.recipientEmail).toBe('');expect(result.body).not.toMatch(/Professor|currently recruiting/);
  });
  it('never turns quiz skills into research achievements',()=>{
    const i=input();i.profile.skillEvidence=[];i.selectedProfileIds=[];const result=buildEmailDraft(i,'en');expect(result.body).not.toMatch(/proficient|experienced|published/);
  });
  it('requires identity and reading confirmation',()=>{
    const i=input();i.identityConfirmed=false;expect(()=>buildPlan(i)).toThrow(/收件人/);
    i.identityConfirmed=true;i.reading.title='Example Paper';expect(()=>buildPlan(i)).toThrow(/阅读层次/);
  });
  it('keeps research out unless source and student confirmation exist',()=>{
    const i=input();i.faculty!.sources=[];expect(buildPlan(i).facts.some(f=>f.id==='recipient:research')).toBe(false);
    i.faculty!.sources=opportunity().sources;i.facultyResearchConfirmed=false;expect(buildPlan(i).facts.some(f=>f.id==='recipient:research')).toBe(false);
  });
  it('accepts a research description at the advertised input length without losing it',async()=>{
    const i=input();i.faculty=null;i.manual.researchSummary='a'.repeat(1800);const plan=buildPlan(i);
    expect(draftText((await generateTemplates(plan,['en']))[0])).toContain(i.manual.researchSummary);
  });
  it('requires a true previous contact for follow-up',()=>{
    const i=input();i.purpose='follow_up';expect(()=>buildPlan(i)).toThrow(/此前/);
    i.followUpDate='2026-01-01';i.followUpConfirmed=true;expect(buildEmailDraft(i).body).toContain('2026-01-01');
  });
});

describe('independent project eligibility, status, and contact policy',()=>{
  function application(){const i=input();i.opportunity=opportunity();i.purpose='application';i.handoff=handoff(i);return i;}
  it('permits a currently open, eligible, official-contact application',()=>{expect(buildEmailDraft(application(),'en').body).toContain('apply for this project');});
  it('requires a selected project for an application',()=>{const i=input();i.purpose='application';expect(()=>buildPlan(i)).toThrow(/选择公开项目/);});
  it.each(['portal_only','no_direct_contact'] as const)('blocks %s',policy=>{const i=application();i.handoff!.policy=policy;expect(()=>buildPlan(i)).toThrow(/指定系统|禁止直接/);});
  it('blocks an ineligible applicant even when recruitment is open',()=>{const i=application();i.handoff!.qualification='ineligible';expect(()=>buildPlan(i)).toThrow(/申请资格/);});
  it('blocks unknown, stale or closed recruitment even when eligibility passes',()=>{
    const i=application();i.opportunity!.status='unknown';expect(()=>buildPlan(i)).toThrow(/开放/);
    i.opportunity!.status='open_confirmed';i.opportunity!.statusVerifiedAt='2020-01-01T00:00:00Z';expect(()=>buildPlan(i)).toThrow(/开放/);
  });
  it('rejects elapsed deadlines and timezone-free deadlines',()=>{
    const i=application();i.opportunity!.deadlineAt='2020-01-01T00:00:00Z';i.opportunity!.deadlineTimeZone='UTC';expect(()=>buildPlan(i)).toThrow(/截止/);
    i.opportunity!.deadlineAt='2030-01-01T00:00:00';expect(()=>buildPlan(i)).toThrow(/时区/);
  });
  it('does not treat a same-name faculty record as a linked supervisor',()=>{const i=application();i.opportunity!.linkedFacultyIds=[];expect(()=>buildPlan(i)).toThrow(/没有明确关联/);});
  it('rejects stale/cross-user handoff and a different target or purpose',()=>{
    const i=application();i.handoff!.ownerUserId='other';expect(()=>buildPlan(i)).toThrow(/失效/);
    i.handoff=handoff(i);i.handoff.profileUpdatedAt='2000-01-01T00:00:00Z';expect(()=>buildPlan(i)).toThrow(/失效/);
    i.handoff=handoff(i);i.handoff.opportunityId='other';expect(()=>buildPlan(i)).toThrow(/不一致/);
    i.handoff=handoff(i);i.purpose='research_enquiry';expect(()=>buildPlan(i)).toThrow(/联系目的/);
  });
  it('enforces recipient, route and purpose-specific prohibitions',()=>{
    const i=application();i.handoff!.recipients[0].publicAddress='other@example.org';expect(()=>buildPlan(i)).toThrow(/联系人/);
    i.handoff=handoff(i);i.handoff.rules=[{recipientRole:'faculty',purpose:'application',permission:'prohibited',evidenceIds:['project-source']}];expect(()=>buildPlan(i)).toThrow(/禁止/);
    i.handoff=handoff(i);i.handoff.recipients[0].evidenceIds=['absent'];expect(()=>buildPlan(i)).toThrow(/官方来源/);
  });
  it('allows explicit manual official review, but not a pasted arbitrary URL',()=>{
    const i=application();i.handoff=null;expect(()=>buildPlan(i)).toThrow(/核对/);
    i.projectReview={contactAllowed:true,eligible:true,checked:true,purpose:'application',officialSourceUrl:'https://example.org/project',email:'research@example.org'};
    expect(checkContact(i,'research@example.org').email).toBe('research@example.org');
    i.projectReview.officialSourceUrl='https://example.org/unrelated';expect(()=>buildPlan(i)).toThrow(/核对/);
  });
  it('does not reuse a manual contact confirmation for a different purpose',()=>{
    const i=application();i.handoff=null;i.projectReview={contactAllowed:true,eligible:true,checked:true,purpose:'research_enquiry',officialSourceUrl:'https://example.org/project',email:'research@example.org'};
    expect(()=>buildPlan(i)).toThrow(/本次联系目的/);
  });
  it('does not apply to demonstration projects',()=>{const i=application();i.opportunity!.isDemo=true;expect(()=>buildPlan(i)).toThrow(/演示/);});
  it('requires a profile-version envelope for legacy handoff',()=>{expect(()=>parseHandoff({schemaVersion:'research-opportunities/0.1'},input().profile)).toThrow(/封装/);});
  it('round-trips the actual legacy contract in a host-bound envelope without inventing recruitment status',()=>{
    const i=application();const h=i.handoff!;const ref={ownerUserId:i.profile.userId,profileId:'test-profile',profileVersion:1};
    const legacy={schemaVersion:'research-opportunities/0.1',profileRef:ref,callId:'test-call',requestedAt:h.requestedAt,purpose:'application',deliveryMode:'draft_only',contactGate:{decision:'allowed',reason:'Synthetic test evidence',evidenceIds:['project-source']},contactPolicy:{mode:h.policy,permittedRouteIds:h.permittedRouteIds,rules:[]},recipients:h.recipients,allowedApplicationRouteIds:h.allowedApplicationRouteIds,qualification:{outcome:'eligible',profileRef:ref}};
    const envelope=createHandoffEnvelope({legacyHandoff:legacy,opportunityId:i.opportunity!.id,sources:i.opportunity!.sources,assessedHostProfileUpdatedAt:i.profile.updatedAt,currentProfile:i.profile});
    i.handoff=parseHandoff(envelope,i.profile);expect(buildPlan(i).purpose).toBe('application');
    i.opportunity!.status='unknown';expect(()=>buildPlan(i)).toThrow(/开放/);
    expect(()=>createHandoffEnvelope({legacyHandoff:legacy,opportunityId:i.opportunity!.id,sources:i.opportunity!.sources,assessedHostProfileUpdatedAt:'2000-01-01T00:00:00Z',currentProfile:i.profile})).toThrow(/重新评估/);
  });
});

describe('strict structured output and bounded factual checks',()=>{
  it.each(['{"a":1,"a":2}','{"x":{"a":1,"a":2}}','{"__proto__":{}}','```json\n{}\n```','{"a":NaN}','{} trailing'])('rejects unsafe or ambiguous JSON %s',raw=>{expect(()=>strictJson(raw)).toThrow();});
  function base(){const i=input();const plan=buildPlan(i);return {plan,draft:templateDraft(plan,'en')};}
  it('rejects unrecognized fields, language mismatch, and unknown fact IDs',()=>{
    const {plan,draft}=base();expect(()=>validateDrafts(JSON.stringify({drafts:[{...draft,extra:'x'}]}),plan,['en'])).toThrow();
    expect(()=>validateDrafts(JSON.stringify({drafts:[draft]}),plan,['zh-CN'])).toThrow(/语言/);
    draft.paragraphs[0].factIds=['made-up'];expect(()=>validateDrafts(JSON.stringify({drafts:[draft]}),plan,['en'])).toThrow(/事实编号/);
  });
  it.each(['My GPA is 4.99.','I have attached my CV.','Your lab is recruiting.','<script>alert(1)</script>'])('rejects unsupported claim %s',text=>{
    const {plan,draft}=base();draft.paragraphs.push({text,factIds:[]});expect(()=>validateDrafts(JSON.stringify({drafts:[draft]}),plan,['en'])).toThrow();
  });
  it('enforces the reading tier in the paragraph citing that fact',()=>{
    const i=input();i.reading={title:'Example Paper',level:'abstract',confirmed:true};const plan=buildPlan(i);const draft=templateDraft(plan,'en');
    draft.paragraphs.push({text:'I have read the full paper Example Paper.',factIds:['student:reading']});expect(()=>validateDrafts(JSON.stringify({drafts:[draft]}),plan,['en'])).toThrow(/层次/);
  });
});
