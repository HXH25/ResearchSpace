/**
 * ResearchSpace Module Contract v1.0.0
 * This is the source of truth. The host must copy it unchanged to src/sdk/contracts.ts.
 * Every feature module imports types ONLY from '@/sdk/contracts'.
 * ISODateTime values are ISO-8601 strings; validate at runtime at data boundaries.
 */
import type { ComponentType } from 'react';

export const CONTRACT_VERSION = '1.0.0' as const;
export type ModuleId = 'faculty' | 'opportunities' | 'community' | 'outreach';
export type ModuleIcon = 'graduation-cap' | 'flask-conical' | 'messages-square' | 'mail';
export type ISODateTime = string;
export type ISODate = string;

export type StudentGoal =
  | 'explore_research'
  | 'join_lab'
  | 'srt'
  | 'summer_research'
  | 'overseas_research'
  | 'postgraduate_preparation';
export type ResearchExperience = 'none' | 'course_projects' | 'prior_research' | 'undecided';
export type WorkPreference =
  | 'literature'
  | 'coding'
  | 'theory'
  | 'experiments'
  | 'data'
  | 'fieldwork'
  | 'undecided';
export type GuidancePreference = 'structured' | 'independent' | 'undecided';
export type AvailabilityWindow = 'now' | 'this_term' | 'next_term' | 'summer' | 'undecided';
export type UndergraduateYear = 'year1' | 'year2' | 'year3' | 'year4' | 'year5' | 'undecided';

export interface StudentProfile {
  schemaVersion: 1;
  userId: string; // UUID generated locally; NOT an authenticated cloud identity
  displayName: string;
  institution: string; // default: 'Tsinghua University'
  department?: string;
  undergraduateYear: UndergraduateYear;
  goals: StudentGoal[];
  researchAreas: string[]; // normalized IDs from host taxonomy; can be empty if undecided
  interestKeywords: string[]; // custom text keywords, optional
  skills: string[];
  skillEvidence?: Array<{ skill: string; description: string; url?: string }>;
  experience: ResearchExperience;
  workPreferences: WorkPreference[];
  guidancePreference: GuidancePreference;
  weeklyHours?: number; // 0..60; undefined means unknown
  availability: AvailabilityWindow;
  preferredLanguages: Array<'zh' | 'en' | 'other'>;
  onboardingCompletedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EvidenceSource {
  /** Unique within its record. */
  id: string;
  title: string;
  url: string; // http(s) only; never javascript: or untrusted local file
  type: 'official' | 'academic' | 'media' | 'community' | 'mock';
  publisher?: string;
  publishedAt?: ISODateTime;
  accessedAt: ISODateTime;
  note?: string;
}

export type RecruitmentStatus = 'confirmed_open' | 'past_opening' | 'closed' | 'unknown';
export interface TeamMemberPublic {
  name: string;
  role: 'faculty' | 'postdoc' | 'phd' | 'masters' | 'undergraduate' | 'alumni' | 'other';
  researchInterests?: string[];
  publicPageUrl?: string;
  sourceIds: string[];
  /** Only public professional info; no private email, phone, relationship, or unverified labels. */
}
export interface FacultyRecord {
  id: string; // stable opaque ID: 'faculty:tsinghua:<slug>' is recommended
  name: string;
  nameEnglish?: string;
  institution: string;
  department?: string;
  officialPage?: string;
  publiclyListedContactEmail?: string;
  researchAreas: string[];
  researchSummary: string;
  selectedWorks?: Array<{ title: string; year?: number; url?: string; doi?: string }>;
  groupName?: string;
  groupPage?: string;
  teamMembers?: TeamMemberPublic[];
  undergraduateParticipation?: string;
  dailyMentorship?: string; // Only with clear attributable evidence
  recruitmentStatus: RecruitmentStatus;
  recruitmentVerifiedAt?: ISODateTime;
  lastCheckedAt: ISODateTime;
  sources: EvidenceSource[];
  isDemo: boolean;
}

export type OpportunityStatus = 'open_confirmed' | 'upcoming' | 'closed' | 'unknown';
export type OpportunityType =
  | 'srt'
  | 'undergraduate_research'
  | 'research_assistant'
  | 'summer_research'
  | 'internship'
  | 'other';
export type EligibilityType = 'tsinghua_only' | 'home_institution_only' | 'international_eligible' | 'open_to_all' | 'unknown';
export interface OpportunityRecord {
  id: string; // stable opaque ID: 'opportunity:<institution>:<slug>'
  title: string;
  institution: string;
  countryOrRegion: string;
  department?: string;
  type: OpportunityType;
  researchAreas: string[];
  summary: string;
  requirements?: string;
  expectedWork?: string;
  duration?: string;
  weeklyHours?: number;
  compensationOrCredit?: string;
  eligibility: EligibilityType;
  eligibilityDetails?: string;
  status: OpportunityStatus;
  statusVerifiedAt?: ISODateTime;
  opensAt?: ISODateTime;
  deadlineAt?: ISODateTime;
  deadlineTimeZone?: string; // e.g. 'Asia/Shanghai'; NEVER silently assume UTC
  applicationUrl?: string;
  contactUrl?: string;
  linkedFacultyIds?: string[];
  lastCheckedAt: ISODateTime;
  sources: EvidenceSource[];
  isDemo: boolean;
}

export interface FacultySearchQuery {
  text?: string;
  researchAreas?: string[];
  institution?: string;
  limit?: number;
}
export interface OpportunitySearchQuery {
  text?: string;
  researchAreas?: string[];
  institution?: string;
  countryOrRegion?: string;
  type?: OpportunityType;
  status?: OpportunityStatus;
  limit?: number;
}
export interface FacultyProvider {
  search(query: FacultySearchQuery, signal?: AbortSignal): Promise<FacultyRecord[]>;
  getById(id: string, signal?: AbortSignal): Promise<FacultyRecord | null>;
}
export interface OpportunityProvider {
  search(query: OpportunitySearchQuery, signal?: AbortSignal): Promise<OpportunityRecord[]>;
  getById(id: string, signal?: AbortSignal): Promise<OpportunityRecord | null>;
}

export interface ScopedUserStorage {
  // Storage is isolated by (active local userId, moduleId), implemented by host.
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export type AiTask = 'faculty_brief' | 'faculty_fit_explanation' | 'opportunity_explanation' | 'outreach_email';
export interface AiGenerateRequest {
  task: AiTask;
  input: string;
  sources?: EvidenceSource[];
  responseFormat: 'text' | 'json';
  containsPersonalData: boolean;
  personalDataConsent: boolean;
  /** The module must show an explicit consent dialog before sending student data to a remote AI provider. */
}
export interface AiGenerateResponse {
  text: string;
  mode: 'demo' | 'live';
  provider?: string;
  createdAt: ISODateTime;
}
export interface AiPort {
  readonly state: 'unconfigured' | 'demo' | 'ready';
  generate(request: AiGenerateRequest, signal?: AbortSignal): Promise<AiGenerateResponse>;
}

export interface CommunityConfig {
  repo: string | null; // owner/name; no guessed default real repo
  repoId: string | null;
  category: string | null;
  categoryId: string | null;
}
export interface HostCatalog {
  searchFaculty(query: FacultySearchQuery, signal?: AbortSignal): Promise<FacultyRecord[]>;
  getFacultyById(id: string, signal?: AbortSignal): Promise<FacultyRecord | null>;
  searchOpportunities(query: OpportunitySearchQuery, signal?: AbortSignal): Promise<OpportunityRecord[]>;
  getOpportunityById(id: string, signal?: AbortSignal): Promise<OpportunityRecord | null>;
}
export interface HostApi {
  navigation: {
    go(path: string): void; // internal absolute /app/... paths only; host enforces safe routing
    facultyPath(id: string): string; // '/app/faculty/<encoded ID>'
    opportunityPath(id: string): string; // '/app/opportunities/<encoded ID>'
  };
  catalog: HostCatalog;
  storage: ScopedUserStorage;
  ai: AiPort;
  config: {
    appMode: 'demo' | 'live';
    /** Optional host UI preferences; changes are delivered through new api props. */
    ui?: { locale: 'zh-CN' | 'en'; theme: 'forest' | 'ocean' | 'violet' | 'rose' | 'amber' };
    community: CommunityConfig;
  };
}
export interface ModulePageProps {
  profile: StudentProfile; // automatically updates when host profile changes
  api: HostApi;
}
export interface ResearchModule {
  contractVersion: typeof CONTRACT_VERSION;
  id: ModuleId;
  title: string;
  summary: string;
  icon: ModuleIcon;
  /** Rendered under /app/<module id>/* . Use nested React Router routes internally. */
  Root: ComponentType<ModulePageProps>;
  providers?: {
    faculty?: FacultyProvider;
    opportunities?: OpportunityProvider;
  };
}
