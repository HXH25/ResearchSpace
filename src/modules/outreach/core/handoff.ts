import { z } from 'zod';
import type { StudentProfile } from '@/sdk/contracts';
import type { DraftInput, Handoff } from '../types';
import { email, fail, httpUrl, recent } from './safety';
import { sourceSchema } from './schemas';

const ids = z.array(z.string().min(1)).max(100);
const legacySchema = z.object({
  schemaVersion: z.literal('research-opportunities/0.1'),
  profileRef: z.object({ ownerUserId: z.string(), profileId: z.string(), profileVersion: z.number().int().nonnegative() }),
  callId: z.string(), requestedAt: z.string(), deliveryMode: z.literal('draft_only'),
  purpose: z.enum(['application','eligibility_question','research_enquiry']),
  contactGate: z.object({ decision: z.enum(['allowed','blocked','needs_verification']), reason: z.string(), evidenceIds: ids }),
  contactPolicy: z.object({
    mode: z.enum(['portal_only','no_direct_contact','specified_contacts_only','direct_contact_allowed','direct_contact_required','unknown']),
    permittedRouteIds: ids,
    rules: z.array(z.object({ recipientRole: z.string(), purpose: z.string(), permission: z.enum(['allowed','required','prohibited','unknown']), evidenceIds: ids })),
  }),
  recipients: z.array(z.object({ routeId: z.string(), personId: z.string().nullable(), role: z.string(), publicAddress: z.email(), evidenceIds: ids.min(1) })).max(30),
  allowedApplicationRouteIds: ids,
  qualification: z.object({ outcome: z.enum(['eligible','ineligible','needs_verification']), profileRef: z.object({ ownerUserId: z.string(), profileId: z.string(), profileVersion: z.number() }) }),
});
// The frozen SDK has updatedAt, not the legacy numeric profileVersion. This explicit
// envelope binds both protocols without guessing a numeric/string conversion.
export function parseHandoff(raw: unknown, profile: StudentProfile): Handoff {
  const envelope = z.object({
    kind: z.literal('researchspace-outreach-handoff/1'), profileUpdatedAt: z.string(),
    opportunityId: z.string().min(1), sources: z.array(sourceSchema).min(1).max(100), handoff: legacySchema,
  }).safeParse(raw);
  if (!envelope.success) fail('HANDOFF_FORMAT', '项目交接格式不完整；需要包含当前画像时间和来源的 ResearchSpace 交接封装。');
  const { handoff: h, sources, profileUpdatedAt, opportunityId } = envelope.data;
  if (h.profileRef.ownerUserId !== profile.userId || h.qualification.profileRef.ownerUserId !== profile.userId) fail('HANDOFF_OWNER', '这份项目交接不属于当前账号。');
  if (profileUpdatedAt !== profile.updatedAt || h.qualification.profileRef.profileVersion !== h.profileRef.profileVersion || h.qualification.profileRef.profileId !== h.profileRef.profileId) fail('HANDOFF_STALE', '交接所用画像已变化，请重新核对项目资格并生成交接。');
  if (!recent(h.requestedAt, 7)) fail('HANDOFF_EXPIRED', '项目交接已过期，请重新核对当前申请状态。');
  return { ownerUserId: profile.userId, profileUpdatedAt, opportunityId, requestedAt: h.requestedAt, purpose: h.purpose,
    qualification: h.qualification.outcome, decision: h.contactGate.decision, policy: h.contactPolicy.mode,
    permittedRouteIds: h.contactPolicy.permittedRouteIds, allowedApplicationRouteIds: h.allowedApplicationRouteIds,
    recipients: h.recipients, rules: h.contactPolicy.rules, sources };
}

export function checkContact(input: DraftInput, targetEmail: string): { email: string; caveats: string[] } {
  const { opportunity: op, handoff: h, purpose, projectReview: review } = input;
  const caveats: string[] = [];
  if (!op) {
    if (h) fail('HANDOFF_TARGET', '请先载入交接对应的项目。');
    if (purpose === 'application') fail('PROJECT_REQUIRED', '正式申请需要先选择公开项目并核对官方申请方式。');
    return { email: targetEmail, caveats: ['未核实当前招生情况，草稿仅以询问方式表达。'] };
  }
  if (input.faculty && !op.linkedFacultyIds?.includes(input.faculty.id)) fail('PROJECT_FACULTY', '该项目没有明确关联这位导师；请使用官方指定联系人。');
  let selectedEmail = targetEmail;
  if (h) {
    if (h.ownerUserId !== input.profile.userId || h.profileUpdatedAt !== input.profile.updatedAt || !recent(h.requestedAt,7)) fail('HANDOFF_STALE', '交接已失效，请根据当前账号和画像重新核对。');
    if (h.opportunityId !== op.id) fail('HANDOFF_TARGET', '交接与当前项目不一致。');
    if (h.purpose !== purpose) fail('HANDOFF_PURPOSE', '联系目的与项目交接不一致，请重新生成交接。');
    if (h.decision !== 'allowed' || h.policy === 'unknown') fail('CONTACT_UNVERIFIED', '官方联系许可尚未确认，请先核对项目申请页面。');
    if (h.policy === 'portal_only' || h.policy === 'no_direct_contact') fail('CONTACT_BLOCKED', '该项目要求通过指定系统办理，或禁止直接联系，请按官方渠道操作。');
    const r = h.recipients.find(r => email(r.publicAddress).toLowerCase() === targetEmail.toLowerCase() && h.permittedRouteIds.includes(r.routeId));
    if (!r) fail('RECIPIENT_BLOCKED', '收件人不在官方允许的联系人列表中。');
    const relevant = h.rules.filter(rule => rule.recipientRole === r.role && (rule.purpose === purpose || rule.purpose === 'any'));
    if (relevant.some(rule => rule.permission === 'prohibited')) fail('CONTACT_BLOCKED', '官方规则禁止以此目的联系该收件人。');
    const official = new Set([...op.sources,...h.sources].filter(s=>s.type==='official' && httpUrl(s.url)).map(s=>s.id));
    if (!r.evidenceIds.some(id=>official.has(id))) fail('CONTACT_EVIDENCE', '收件方式缺少可核查的官方来源。');
    if (purpose === 'application' && (h.qualification !== 'eligible' || !h.allowedApplicationRouteIds.includes(r.routeId))) fail('QUALIFICATION', '尚未确认申请资格，或当前联系渠道不允许提交申请。');
    selectedEmail = r.publicAddress;
  } else {
    const official = op.sources.filter(s=>s.type==='official').some(s=>httpUrl(s.url) === httpUrl(review.officialSourceUrl));
    if (!review.checked || review.purpose !== purpose || !review.contactAllowed || !official || !email(review.email)) fail('CONTACT_REVIEW', '请根据列出的官方来源核对本次联系目的、指定邮箱与申请资格。');
    if (targetEmail && review.email.toLowerCase() !== targetEmail.toLowerCase()) fail('RECIPIENT_MISMATCH', '指定联系邮箱与当前收件人不一致，请先核对。');
    if (purpose === 'application' && !review.eligible) fail('QUALIFICATION', '未确认符合申请资格，可先选择资格咨询。');
    selectedEmail = review.email;
    caveats.push('项目联系渠道与资格由你依据官方来源核对，系统不将其视为独立资格认证。');
  }
  if (purpose === 'application') {
    if (op.isDemo || op.sources.some(s=>s.type==='mock')) fail('DEMO_APPLICATION', '演示项目不能作为真实申请对象。');
    if (op.status !== 'open_confirmed' || !recent(op.statusVerifiedAt) || !op.sources.some(s=>s.type==='official')) fail('NOT_OPEN', '缺少近期官方开放证据，目前不能生成正式申请。');
    if (op.opensAt && Date.parse(op.opensAt) > Date.now()) fail('NOT_OPEN', '申请尚未开始。');
    if (op.deadlineAt) {
      if (!/[T].*(Z|[+-]\d{2}:\d{2})$/i.test(op.deadlineAt) || !op.deadlineTimeZone) fail('DEADLINE_UNCERTAIN', '截止时间缺少明确时区，请先核实。');
      if (Date.parse(op.deadlineAt) <= Date.now()) fail('CLOSED', '该项目已超过公布的申请截止时间。');
    }
  }
  if (op.status !== 'open_confirmed') caveats.push('项目招募状态未确认为开放，正文不声称正在招募。');
  return { email: selectedEmail, caveats };
}
