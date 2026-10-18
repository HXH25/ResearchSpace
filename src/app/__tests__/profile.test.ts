import { describe, expect, it } from 'vitest';
import { defaultProfile, profileCompleteness, summarizeProfile, toggleValue } from '@/app/utils/profile';

describe('student research profile', () => {
  it('starts without claiming research experience or determining interests', () => {
    const profile = defaultProfile('local-user-a', '同学 A');
    expect(profile.schemaVersion).toBe(1);
    expect(profile.researchAreas).toEqual([]);
    expect(profile.experience).toBe('undecided');
    expect(profileCompleteness(profile)).toBe(0);
    expect(summarizeProfile(profile).areas).toBe('还在探索中');
  });

  it('only reports completion of the questionnaire, not research ability', () => {
    const profile = defaultProfile('local-user-a', '同学 A');
    const complete = {
      ...profile,
      undergraduateYear: 'year2' as const,
      goals: ['srt' as const],
      researchAreas: ['ai-computing'],
      experience: 'course_projects' as const,
      workPreferences: ['coding' as const],
      availability: 'this_term' as const,
    };
    expect(profileCompleteness(complete)).toBe(100);
    expect(summarizeProfile(complete).areas).toContain('AI');
  });

  it('supports multi-choice and respects choice limits', () => {
    expect(toggleValue(['first'], 'first')).toEqual([]);
    expect(toggleValue(['first'], 'second', 1)).toEqual(['first']);
    expect(toggleValue(['first'], 'second', 2)).toEqual(['first', 'second']);
  });
});
