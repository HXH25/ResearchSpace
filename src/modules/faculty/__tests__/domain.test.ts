import { describe, expect, it } from 'vitest';
import data from '../fixtures/faculty.json';
import { explainMatch, parseEntries, recentlyVerified, safeUrl } from '../domain';
import { demoRepository, createFacultyRepository, StaticFacultyAdapter, UnconfiguredFacultyAdapter } from './staticRepository';
import facultyModule from '../module';
import { student } from './helpers';

describe('faculty data boundary and provider', () => {
  it('keeps the frozen protocol and limits static demo records to test fixtures', async () => {
    expect(facultyModule.id).toBe('faculty'); expect(facultyModule.contractVersion).toBe('1.0.0');
    const records = await demoRepository.provider.search({});
    expect(records).toHaveLength(6);
    expect(records.every(record => record.isDemo && record.sources.every(source => source.type === 'mock'))).toBe(true);
    expect(await demoRepository.provider.getById(records[0].id)).toEqual(records[0]);
    expect(await demoRepository.provider.getById('missing')).toBeNull();
  });
  it('combines multilingual keywords, institution and area filters; honors the limit', async () => {
    const { provider } = createFacultyRepository(new StaticFacultyAdapter());
    expect((await provider.search({ text: 'LLM 幻觉', institution: '清华', researchAreas: ['ai-computing'] })).map(record => record.id)).toEqual(['faculty:demo:language']);
    expect(await provider.search({ text: 'robotics', researchAreas: ['bio-medicine'] })).toEqual([]);
    expect(await provider.search({ limit: 0 })).toEqual([]);
    expect(await provider.search({ limit: 2 })).toHaveLength(2);
    expect(await provider.search({ text: 'not-a-research-topic' })).toEqual([]);
  });
  it('keeps people with identical names separate and rejects duplicate IDs', () => {
    const records = structuredClone(data.slice(0, 2)); records[1].faculty.name = records[0].faculty.name;
    expect(parseEntries(records)).toHaveLength(2);
    records[1].faculty.id = records[0].faculty.id; expect(() => parseEntries(records)).toThrow(/重复编号/);
  });
  it('rejects unsafe URLs, malformed sources and invalid dates at runtime', () => {
    const broken = structuredClone(data); broken[0].faculty.sources[0].url = 'javascript:alert(1)';
    expect(() => parseEntries(broken)).toThrow();
    expect(safeUrl('https://username:password@example.com')).toBeUndefined();
    broken[0].faculty.sources[0].url = 'https://example.invalid'; broken[0].faculty.lastCheckedAt = 'yesterday';
    expect(() => parseEntries(broken)).toThrow();
  });
  it('allows missing optional facts, but strips unsupported mentor relationships', () => {
    const records = parseEntries(data.slice(0, 1)); records[0].factSourceIds = { background: [], works: [], team: [], participation: [], mentorship: [], recruitment: [] };
    records[0].faculty.teamMembers![0].sourceIds = ['unknown'];
    const record = parseEntries(records)[0].faculty;
    expect(record.teamMembers).toEqual([]); expect(record.undergraduateParticipation).toBeUndefined(); expect(record.selectedWorks).toEqual([]);
  });
  it('only accepts confirmed openings with attributed official evidence and a recent, non-future check', () => {
    const now = Date.parse('2026-10-18T12:00:00Z');
    const original = parseEntries(data)[1];
    original.faculty.isDemo = false; original.faculty.sources[0].type = 'official'; original.faculty.recruitmentStatus = 'confirmed_open';
    original.faculty.recruitmentVerifiedAt = '2026-10-01T00:00:00Z';
    expect(parseEntries([original], now)[0].faculty.recruitmentStatus).toBe('confirmed_open');
    const stale = structuredClone(original); stale.faculty.recruitmentVerifiedAt = '2025-10-01T00:00:00Z';
    expect(parseEntries([stale], now)[0].faculty.recruitmentStatus).toBe('unknown');
    const future = structuredClone(original); future.faculty.recruitmentVerifiedAt = '2027-01-01T00:00:00Z';
    expect(parseEntries([future], now)[0].faculty.recruitmentStatus).toBe('unknown');
    const missing = structuredClone(original); missing.factSourceIds.recruitment = [];
    expect(parseEntries([missing], now)[0].faculty.recruitmentStatus).toBe('unknown');
    const mock = structuredClone(original); mock.faculty.sources[0].type = 'mock';
    expect(parseEntries([mock], now)[0].faculty.recruitmentStatus).toBe('unknown');
    expect(parseEntries([mock], now)[0].faculty.isDemo).toBe(true);
    expect(recentlyVerified(undefined, now)).toBe(false);
  });
  it('supports fixture cancellation and rejects invalid data without fallback', async () => {
    const unavailable = createFacultyRepository(new UnconfiguredFacultyAdapter());
    await expect(unavailable.provider.search({})).rejects.toThrow(/尚未接入/);
    const controller = new AbortController(); controller.abort();
    await expect(demoRepository.provider.search({}, controller.signal)).rejects.toThrow();
    const invalid = createFacultyRepository(new StaticFacultyAdapter([{ broken: true }]));
    await expect(invalid.provider.search({})).rejects.toThrow(/校验失败/);
    const failed = createFacultyRepository({ async load() { throw new Error('offline'); } });
    await expect(failed.provider.search({})).rejects.toThrow('offline');
  });
});
describe('explainable local matching', () => {
  const entry = parseEntries(data)[0];
  it('uses only declared interests for the score and explains evidence, time and unknowns', () => {
    const fit = explainMatch(entry, student());
    expect(fit.score).toBe(100); expect(fit.interest).toContain('幻觉');
    expect(fit.evidence.join('')).toContain('课程练习'); expect(fit.time).toContain('5 小时');
    expect(fit.unknowns.join('')).toContain('无法判断当前能否加入');
    expect(explainMatch(entry, student({ skills: [], weeklyHours: 0 })).score).toBe(fit.score);
    expect(explainMatch(entry, student({ researchAreas: ['bio-medicine'], interestKeywords: [] })).score).toBe(0);
  });
  it('does not rate undecided students as zero or invent skills', () => {
    const fit = explainMatch(entry, student({ researchAreas: [], interestKeywords: [], skills: [], skillEvidence: [], weeklyHours: undefined }));
    expect(fit.score).toBeNull(); expect(fit.preparation).toEqual([]); expect(fit.evidence).toEqual([]);
    expect(fit.unknowns.join('')).toContain('不代表缺乏科研潜力');
  });
});
