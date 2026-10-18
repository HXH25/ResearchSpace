import { z } from 'zod';
import type { OpportunityProvider, OpportunityRecord, ResearchModule, ModuleId } from '@/sdk/contracts';
import { localRequest } from './client';
import { createFacultyProvider } from './faculty';

const http = z.string().url().refine(s => /^https?:\/\//.test(s));
const source = z.object({id: z.string(), title: z.string(), url: http, type: z.enum(['official', 'academic', 'media', 'community', 'mock']), accessedAt: z.string(), note: z.string().optional()});
const srt = z.object({project_id: z.string(), initiation_type: z.enum(['teacher', 'student']).optional(),
  applicant: z.string().nullish(), academic_term: z.string().nullish(), batch: z.union([z.string(), z.number()]).nullish(),
  department: z.string().nullish(), mentor_department: z.string().nullish(), mentor_title: z.string().nullish(),
  mentor_awards: z.string().nullish(), capacity: z.string().nullish(), credits: z.string().nullish(), category: z.string().nullish(),
  expected_outcomes: z.string().nullish(), resources: z.string().nullish(), schedule: z.string().nullish(),
  budget: z.string().nullish(), funding_requested: z.string().nullish(), other_funding: z.string().nullish(),
  applicant_class: z.string().nullish(), applicant_experience_awards: z.string().nullish(), status: z.string().nullish(),
}).passthrough();
const record = z.object({linkedFacultyIds: z.array(z.string()).optional(), id: z.string(), title: z.string(), institution: z.string(), countryOrRegion: z.string(), department: z.string().optional(), type: z.enum(['srt', 'undergraduate_research', 'research_assistant', 'summer_research', 'internship', 'other']), researchAreas: z.array(z.string()), summary: z.string(), requirements: z.string().optional(), expectedWork: z.string().optional(), duration: z.string().optional(), weeklyHours: z.number().optional(), eligibility: z.enum(['tsinghua_only', 'home_institution_only', 'international_eligible', 'open_to_all', 'unknown']), eligibilityDetails: z.string().optional(), status: z.enum(['open_confirmed', 'upcoming', 'closed', 'unknown']), statusVerifiedAt: z.string().optional(), applicationUrl: http.optional(), lastCheckedAt: z.string(), sources: z.array(source), isDemo: z.boolean()});
const project = z.object({id: z.string(), title: z.string(), description: z.string(), institution: z.string(), department: z.string(), region: z.string(), period_text: z.string(), mentors: z.array(z.string()), team: z.string(), mentor_background: z.string(), eligibility_text: z.string(), application_method: z.string(), application_url: z.string(), source_url: http, source_id: z.string(), collected_at: z.string(), deadline: z.string(), visibility: z.enum(['public', 'private']), kind: z.string(), effective_status: z.string(), warnings: z.array(z.string()), missing_fields: z.array(z.string()), contract: record,
  match: z.object({score: z.number(), reasons: z.array(z.string()), conflicts: z.array(z.string()), unknowns: z.array(z.string()), preparations: z.array(z.string()), note: z.string()}).passthrough().optional(),
  srt: srt.optional(),
}).passthrough();
export type Project = z.infer<typeof project>;
export const parseProject = (data: unknown) => project.parse(data);
export const parseProjects = (data: unknown) => z.object({items: z.array(project), total: z.number(), page: z.number(), page_size: z.number()}).parse(data);

export function createOpportunityProvider(userId: string): OpportunityProvider {
  return {
    async search(query, signal) {
      const params = new URLSearchParams({q: query.text || '', page_size: '100'});
      if (query.institution) params.set('institution', query.institution);
      if (query.countryOrRegion) params.set('region', query.countryOrRegion);
      if (query.type) params.set('type', query.type);
      if (query.status) params.set('status', query.status === 'open_confirmed' ? 'open' : query.status);
      if (query.researchAreas?.length) params.set('areas', query.researchAreas.join(','));
      const list = parseProjects(await localRequest(userId, '/api/projects?' + params, {signal}));
      return list.items.map(x => x.contract as OpportunityRecord).slice(0, query.limit ?? 100);
    },
    async getById(id, signal) {
      try {return parseProject(await localRequest(userId, '/api/projects/' + encodeURIComponent(id), {signal})).contract as OpportunityRecord;}
      catch (e) {if (signal?.aborted) throw e; return null;}
    },
  };
}
export function scopeModules(modules: Partial<Record<ModuleId, ResearchModule>>, userId: string) {
  return {...modules,
    ...(modules.faculty ? {faculty: {...modules.faculty, providers: {...modules.faculty.providers, faculty: createFacultyProvider(userId)}}} : {}),
    ...(modules.opportunities ? {opportunities: {...modules.opportunities, providers: {...modules.opportunities.providers, opportunities: createOpportunityProvider(userId)}}} : {}),
  };
}
