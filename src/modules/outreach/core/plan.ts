import type { EvidenceSource } from '@/sdk/contracts';
import type { DraftInput, EmailPlan, Fact } from '../types';
import { checkContact } from './handoff';
import { profileChoices } from './profile';
import { clean, email, fail, httpUrl } from './safety';
import { facultySchema, opportunitySchema, planSchema } from './schemas';

export function buildPlan(input: DraftInput): EmailPlan {
  const signature = clean(input.signature,100);
  if (!signature || /[\r\n]/.test(signature)) fail('SIGNATURE', '请填写单行署名（可以使用你确认的昵称）。');
  const faculty = input.faculty ? facultySchema.parse(input.faculty) : null;
  const opportunity = input.opportunity ? opportunitySchema.parse(input.opportunity) : null;
  const name = clean(faculty?.name || input.manual.name,100);
  if (!name) fail('RECIPIENT_REQUIRED','请填写收件人姓名或机构称呼。');
  if (!(faculty ? input.identityConfirmed : input.manual.identityConfirmed)) fail('IDENTITY_CONFIRM','请先确认收件人与学校／主页对应，避免同名混淆。');
  if (input.manual.email && !email(input.manual.email)) fail('EMAIL_FORMAT','收件邮箱格式不正确。');
  if (!faculty && input.manual.officialPage && !httpUrl(input.manual.officialPage)) fail('URL_FORMAT','公开主页需要有效的 http(s) 地址。');
  const { email: targetEmail, caveats } = checkContact({...input, faculty, opportunity}, email(faculty?.publiclyListedContactEmail || input.manual.email));
  const facts: Fact[] = [];
  const sources: EvidenceSource[] = [];
  const addSources = (prefix: string, items: EvidenceSource[]) => {
    const mapped = items.map(s=>({...s,id:`${prefix}:${s.id}`})); sources.push(...mapped); return mapped.map(s=>s.id);
  };
  const available = profileChoices(input.profile);
  const selected = new Set(input.selectedProfileIds);
  if (Array.from(selected).some(id=>!available.some(c=>c.id===id))) fail('PROFILE_CHANGED','所选画像字段已变化，请重新确认。');
  for (const p of available.filter(p=>selected.has(p.id))) facts.push({id:p.id,text:p.text,english:p.english,owner:'student',kind:p.kind,sourceIds:[]});
  facts.push({id:'student:signature',text:signature,english:signature,owner:'student',kind:'signature',sourceIds:[]});
  const facultySources = faculty ? addSources('faculty',faculty.sources) : [];
  const projectSources = opportunity ? addSources('project',opportunity.sources) : [];
  if (input.handoff) addSources('handoff',input.handoff.sources);
  if (faculty && input.facultyResearchConfirmed && faculty.researchSummary && faculty.sources.some(s=>s.type==='official'||s.type==='academic')) {
    facts.push({id:'recipient:research',text:clean(faculty.researchSummary,1800),english:clean(faculty.researchSummary,1800),owner:'recipient',kind:'research',sourceIds:facultySources});
  } else if (!faculty && input.manual.researchConfirmed && input.manual.researchSummary && httpUrl(input.manual.officialPage)) {
    sources.push({id:'manual:homepage',title:'用户提供并核对的公开主页',url:httpUrl(input.manual.officialPage)!,type:'official',accessedAt:new Date().toISOString(),note:'由用户手动核对，未自动认证页面权威性。'});
    facts.push({id:'recipient:research',text:clean(input.manual.researchSummary,1800),english:clean(input.manual.researchSummary,1800),owner:'recipient',kind:'research',sourceIds:['manual:homepage']});
    caveats.push('导师研究信息来自你手动核对的资料，保留来源供再次检查。');
  } else caveats.push('未采用未经确认的导师研究陈述。');
  if (opportunity) facts.push({id:'project:title',text:opportunity.title,english:opportunity.title,owner:'project',kind:'project',sourceIds:projectSources});
  if (input.reading.title.trim()) {
    if (!input.reading.confirmed) fail('READING_CONFIRM','请确认实际阅读层次；也可清空资料标题，不提阅读经历。');
    facts.push({id:'student:reading',text:clean(input.reading.title,250),english:clean(input.reading.title,250),owner:'student',kind:'reading',sourceIds:[],readingLevel:input.reading.level});
  }
  if (input.purpose === 'follow_up') {
    if (!input.followUpConfirmed || !/^\d{4}-\d{2}-\d{2}$/.test(input.followUpDate) || !Number.isFinite(Date.parse(input.followUpDate)) || Date.parse(input.followUpDate)>Date.now()) fail('FOLLOWUP_CONFIRM','跟进邮件需要你确认此前确实联系过，并填写过去的联系日期。');
    facts.push({id:'student:followup',text:input.followUpDate,english:input.followUpDate,owner:'student',kind:'followup',sourceIds:[]});
  }
  const materials = input.materials.map(m=>clean(m,180)).filter(Boolean).slice(0,5);
  materials.forEach((m,i)=>facts.push({id:`student:material:${i}`,text:m,english:m,owner:'student',kind:'material',sourceIds:[]}));
  if (!targetEmail) caveats.push('未找到并核实公开邮箱；请在自己的邮箱客户端填写正确地址。');
  const isDemo = Boolean(faculty?.isDemo || opportunity?.isDemo || sources.some(s=>s.type==='mock'));
  if (isDemo) caveats.push('演示数据／非真实导师或项目，不应直接用于联系。');
  caveats.push('本地模板保留自由填写事实的原语言；跨语言邮件请检查这些内容的翻译。');
  const plan: EmailPlan = {
    ownerUserId:input.profile.userId,profileUpdatedAt:input.profile.updatedAt,createdAt:new Date().toISOString(),
    facultyId:faculty?.id,opportunityId:opportunity?.id,recordCheckedAt:opportunity?.lastCheckedAt || faculty?.lastCheckedAt,
    recipientName:name,recipientNameEnglish:faculty?.nameEnglish || name,recipientEmail:targetEmail,signature,
    purpose:input.purpose,tone:input.tone,length:input.length,facts,sources,caveats,
    attachmentSuggestions: materials.length ? materials : ['个人简历（确认后自行附上）','相关作品或课程项目链接（如有）'],isDemo,
  };
  return planSchema.parse(plan);
}
