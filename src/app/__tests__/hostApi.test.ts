import { describe, expect, it, vi } from 'vitest';
import { makeHostApi } from '@/app/services/hostApi';
import type { ResearchModule, FacultyRecord, OpportunityRecord } from '@/sdk/contracts';

const now = new Date().toISOString();
const faculty: FacultyRecord = {
  id: 'faculty:demo:x', name: '示例研究者（非真实）', institution: '虚构大学',
  researchAreas: ['ai-computing'], researchSummary: '仅供接口联调',
  recruitmentStatus: 'unknown', lastCheckedAt: now, sources: [], isDemo: true,
};
const opportunity: OpportunityRecord = {
  id: 'opportunity:demo:y', title: '示例科研项目', institution: '虚构大学', countryOrRegion: '演示',
  type: 'srt', researchAreas: ['ai-computing'], summary: '仅供联调',
  eligibility: 'unknown', status: 'unknown', lastCheckedAt: now, sources: [], isDemo: true,
};
function create(navigate=vi.fn(), modules: Partial<Record<ResearchModule['id'],ResearchModule>>={}) {
  return {navigate, api: makeHostApi({userId:'alice',moduleId:'outreach',modules,navigate})};
}

describe('host module API', () => {
  it('returns stable empty fallbacks when faculty and opportunity plugins are absent', async () => {
    const {api}=create();
    expect(await api.catalog.searchFaculty({text:'AI'})).toEqual([]);
    expect(await api.catalog.getFacultyById('not-installed')).toBeNull();
    expect(await api.catalog.searchOpportunities({text:'SRT'})).toEqual([]);
    expect(await api.catalog.getOpportunityById('not-installed')).toBeNull();
  });

  it('uses the installed providers for cross-module lookups', async () => {
    const emptyRoot = () => null;
    const {api}=create(vi.fn(), {
      faculty: {contractVersion:'1.0.0',id:'faculty',title:'导师',summary:'导师模块',icon:'graduation-cap',Root:emptyRoot,
        providers:{faculty:{search:async()=>[faculty],getById:async()=>faculty}}},
      opportunities:{contractVersion:'1.0.0',id:'opportunities',title:'项目',summary:'机会模块',icon:'flask-conical',Root:emptyRoot,
        providers:{opportunities:{search:async()=>[opportunity],getById:async()=>opportunity}}},
    });
    expect(await api.catalog.searchFaculty({text:'demo'})).toEqual([faculty]);
    expect((await api.catalog.getOpportunityById(opportunity.id))?.status).toBe('unknown');
    expect((await api.catalog.getFacultyById(faculty.id))?.id).toBe(faculty.id);
    expect(await api.catalog.searchOpportunities({text:'demo'})).toEqual([opportunity]);
  });

  it('only allows normalized in-app navigation', () => {
    const {api,navigate}=create();
    api.navigation.go('/app/faculty?q=materials');
    expect(navigate).toHaveBeenCalledWith('/app/faculty?q=materials');
    expect(() => api.navigation.go('https://bad.example')).toThrow();
    expect(() => api.navigation.go('/app/../welcome')).toThrow();
    expect(() => api.navigation.go('/app/%2e%2e/welcome')).toThrow();
    expect(() => api.navigation.go('//evil.example/app')).toThrow();
  });

  it('refuses personal-data AI requests without explicit consent', async () => {
    const {api}=create();
    await expect(api.ai.generate({
      task:'outreach_email', input:'private text', responseFormat:'text',
      containsPersonalData:true,personalDataConsent:false,
    })).rejects.toThrow('尚未同意');
  });
});
