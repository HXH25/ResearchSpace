import type { EvidenceSource, FacultyRecord, HostApi, OpportunityRecord, StudentProfile } from '@/sdk/contracts';

export const OUTREACH_VERSION = '2.1.0';
export const LANGUAGES = ['zh-CN', 'en', 'de', 'ja', 'fr'] as const;
export type Language = typeof LANGUAGES[number];
export type Purpose = 'research_enquiry' | 'application' | 'eligibility_question' | 'materials' | 'public_event' | 'follow_up';
export type ReadingLevel = 'introduction' | 'abstract' | 'full' | 'reproduced';
export interface Reading { title: string; level: ReadingLevel; confirmed: boolean }
export interface Diagnostic { code: string; message: string; level: 'info' | 'warning' | 'error' }
export interface ProfileChoice { id: string; label: string; text: string; english: string; kind: 'identity' | 'interest' | 'experience' | 'availability' }
export interface ManualRecipient { name: string; institution: string; email: string; officialPage: string; researchSummary: string; identityConfirmed: boolean; researchConfirmed: boolean }
export interface ProjectReview {
  contactAllowed: boolean; eligible: boolean; officialSourceUrl: string; email: string; checked: boolean; purpose: Purpose | null;
}
export interface Handoff {
  ownerUserId: string; profileUpdatedAt: string; opportunityId: string; requestedAt: string;
  purpose: 'application' | 'eligibility_question' | 'research_enquiry';
  qualification: 'eligible' | 'ineligible' | 'needs_verification';
  decision: 'allowed' | 'blocked' | 'needs_verification';
  policy: 'portal_only' | 'no_direct_contact' | 'specified_contacts_only' | 'direct_contact_allowed' | 'direct_contact_required' | 'unknown';
  permittedRouteIds: string[]; allowedApplicationRouteIds: string[];
  recipients: Array<{ routeId: string; personId: string | null; role: string; publicAddress: string; evidenceIds: string[] }>;
  rules: Array<{ recipientRole: string; purpose: string; permission: string; evidenceIds: string[] }>;
  sources: EvidenceSource[];
}
export interface DraftInput {
  profile: StudentProfile; selectedProfileIds: string[];
  faculty: FacultyRecord | null; manual: ManualRecipient; opportunity: OpportunityRecord | null;
  handoff: Handoff | null; projectReview: ProjectReview;
  signature: string; purpose: Purpose; tone: 'formal' | 'concise'; length: 'short' | 'standard';
  reading: Reading; materials: string[]; followUpDate: string; followUpConfirmed: boolean;
  identityConfirmed: boolean; facultyResearchConfirmed: boolean;
}
export interface Fact {
  id: string; text: string; english: string; owner: 'student' | 'recipient' | 'project' | 'intent';
  kind: string; sourceIds: string[]; readingLevel?: ReadingLevel;
}
export interface EmailPlan {
  ownerUserId: string; profileUpdatedAt: string; createdAt: string;
  facultyId?: string; opportunityId?: string; recordCheckedAt?: string;
  recipientName: string; recipientNameEnglish: string; recipientEmail: string; signature: string;
  purpose: Purpose; tone: 'formal' | 'concise'; length: 'short' | 'standard';
  facts: Fact[]; sources: EvidenceSource[]; caveats: string[]; attachmentSuggestions: string[]; isDemo: boolean;
}
export interface Paragraph { text: string; factIds: string[] }
export interface DraftPayload { language: Language; subject: string; salutation: string; paragraphs: Paragraph[]; closing: string; signature: string }
export interface DraftDocument {
  schemaVersion: 2; id: string; ownerUserId: string; name: string;
  createdAt: string; updatedAt: string; status: 'draft' | 'sent' | 'replied' | 'closed';
  mode: 'template' | 'ai' | 'ai-demo'; edited: boolean; plan: EmailPlan; payload: DraftPayload;
}
export interface SearchHit { title: string; url: string; snippet: string }
export interface FetchedPage { url: string; title: string; text: string; accessedAt: string }
export interface SearchPort { search(query: string, signal?: AbortSignal): Promise<SearchHit[]> }
export interface FetchPort { fetch(url: string, signal?: AbortSignal): Promise<FetchedPage> }
export interface ResearchResult { faculty: FacultyRecord[]; opportunities: OpportunityRecord[]; links: SearchHit[]; pages: FetchedPage[]; diagnostics: Diagnostic[] }
export interface ResearchPort { research(query: { name: string; institution: string; homepage?: string }, signal?: AbortSignal): Promise<ResearchResult> }
export interface PlannerPort { plan(input: DraftInput): EmailPlan }
export interface ValidatorPort { validate(raw: string, plan: EmailPlan, languages: Language[]): DraftPayload[] }
export interface GeneratorPort { generate(plan: EmailPlan, languages: Language[], signal?: AbortSignal): Promise<DraftPayload[]> }
export interface DraftRepository { list(): Promise<DraftDocument[]>; save(draft: DraftDocument): Promise<void>; remove(id: string): Promise<void> }
export interface OutreachOverrides {
  search?: SearchPort; fetch?: FetchPort;
  researcher?: (api: HostApi) => ResearchPort;
  planner?: PlannerPort; validator?: ValidatorPort; template?: GeneratorPort;
  repository?: (api: HostApi, ownerUserId: string) => DraftRepository;
}
