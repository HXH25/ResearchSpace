import { vi } from 'vitest';
import type { HostApi, StudentProfile } from '@/sdk/contracts';

export function student(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    schemaVersion: 1, userId: 'synthetic-student-one', displayName: '测试用户', institution: 'Tsinghua University',
    undergraduateYear: 'year2', goals: ['srt'], researchAreas: ['ai-computing'], interestKeywords: ['幻觉'],
    skills: ['programming'], skillEvidence: [{ skill: 'programming', description: '写过一个课程练习脚本' }],
    experience: 'course_projects', workPreferences: ['coding'], guidancePreference: 'structured', weeklyHours: 5,
    availability: 'this_term', preferredLanguages: ['zh'], updatedAt: '2026-10-18T00:00:00Z', ...overrides,
  };
}
export function testApi() {
  const memory = new Map<string, unknown>();
  const api: HostApi = {
    navigation: { go: vi.fn(), facultyPath: id => '/app/faculty/' + encodeURIComponent(id), opportunityPath: id => '/app/opportunities/' + encodeURIComponent(id) },
    catalog: { searchFaculty: vi.fn(async () => []), getFacultyById: vi.fn(async () => null), searchOpportunities: vi.fn(async () => []), getOpportunityById: vi.fn(async () => null) },
    storage: { get: async <T>(key: string) => structuredClone(memory.get(key) ?? null) as T | null, set: vi.fn(async (key, value) => { memory.set(key, structuredClone(value)); }), remove: vi.fn(async key => { memory.delete(key); }) },
    ai: { state: 'unconfigured', generate: vi.fn(async () => { throw new Error('AI must not be called'); }) },
    config: { appMode: 'demo', community: { repo: null, repoId: null, category: null, categoryId: null } },
  };
  return { api, memory };
}
