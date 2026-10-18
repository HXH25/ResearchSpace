import { z } from 'zod';
import { httpUrl } from './safety';
import { LANGUAGES } from '../types';

const text = z.string().trim().min(1).max(3000);
const url = z.string().refine(value => !!httpUrl(value));
const stamp = z.string().refine(value => Number.isFinite(Date.parse(value)));
export const sourceSchema = z.object({
  id: z.string().min(1).max(200), title: text, url,
  type: z.enum(['official', 'academic', 'media', 'community', 'mock']),
  publisher: z.string().optional(), publishedAt: stamp.optional(), accessedAt: stamp, note: z.string().optional(),
});
export const facultySchema = z.object({
  id: text, name: text, nameEnglish: text.optional(), institution: z.string(), department: z.string().optional(),
  officialPage: url.optional(), publiclyListedContactEmail: z.email().optional(),
  researchAreas: z.array(text).max(50), researchSummary: z.string().max(10000),
  selectedWorks: z.array(z.object({ title: text, year: z.number().int().optional(), url: url.optional(), doi: z.string().optional() })).optional(),
  groupName: z.string().optional(), groupPage: url.optional(),
  recruitmentStatus: z.enum(['confirmed_open', 'past_opening', 'closed', 'unknown']),
  recruitmentVerifiedAt: stamp.optional(), lastCheckedAt: stamp, sources: z.array(sourceSchema).max(100), isDemo: z.boolean(),
});
export const opportunitySchema = z.object({
  id: text, title: text, institution: z.string(), countryOrRegion: z.string(), department: z.string().optional(),
  type: z.enum(['srt','undergraduate_research','research_assistant','summer_research','internship','other']),
  researchAreas: z.array(text), summary: z.string().max(10000), requirements: z.string().optional(),
  expectedWork: z.string().optional(), duration: z.string().optional(), weeklyHours: z.number().optional(), compensationOrCredit: z.string().optional(),
  eligibility: z.enum(['tsinghua_only','home_institution_only','international_eligible','open_to_all','unknown']),
  eligibilityDetails: z.string().optional(), status: z.enum(['open_confirmed','upcoming','closed','unknown']),
  statusVerifiedAt: stamp.optional(), opensAt: stamp.optional(), deadlineAt: stamp.optional(), deadlineTimeZone: z.string().optional(),
  applicationUrl: url.optional(), contactUrl: url.optional(), linkedFacultyIds: z.array(text).optional(), lastCheckedAt: stamp,
  sources: z.array(sourceSchema).max(100), isDemo: z.boolean(),
});
export const payloadSchema = z.object({
  language: z.enum(LANGUAGES), subject: z.string().trim().min(1).max(180).refine(v => !/[\r\n]/.test(v)),
  salutation: z.string().trim().min(1).max(250).refine(v => !/[\r\n]/.test(v)),
  paragraphs: z.array(z.object({ text: z.string().trim().min(1).max(2400), factIds: z.array(z.string().min(1).max(200)).max(60) }).strict()).min(1).max(12),
  closing: z.string().trim().min(1).max(200), signature: z.string().trim().min(1).max(100),
}).strict();
export const factSchema = z.object({
  id: text, text: z.string().max(3000), english: z.string().max(3000), owner: z.enum(['student','recipient','project','intent']),
  kind: z.string(), sourceIds: z.array(z.string()), readingLevel: z.enum(['introduction','abstract','full','reproduced']).optional(),
}).strict();
export const planSchema = z.object({
  ownerUserId: text, profileUpdatedAt: stamp, createdAt: stamp, facultyId: text.optional(), opportunityId: text.optional(), recordCheckedAt: stamp.optional(),
  recipientName: text, recipientNameEnglish: text, recipientEmail: z.string(), signature: text,
  purpose: z.enum(['research_enquiry','application','eligibility_question','materials','public_event','follow_up']),
  tone: z.enum(['formal','concise']), length: z.enum(['short','standard']), facts: z.array(factSchema).max(100), sources: z.array(sourceSchema).max(200),
  caveats: z.array(z.string()), attachmentSuggestions: z.array(z.string()), isDemo: z.boolean(),
}).strict();
export const documentSchema = z.object({
  schemaVersion: z.literal(2), id: z.string().uuid(), ownerUserId: text, name: z.string().trim().min(1).max(120),
  createdAt: stamp, updatedAt: stamp, status: z.enum(['draft','sent','replied','closed']), mode: z.enum(['template','ai','ai-demo']),
  edited: z.boolean(), plan: planSchema, payload: payloadSchema,
}).strict();
