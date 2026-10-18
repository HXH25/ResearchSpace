import type { FacultyProvider, FacultySearchQuery } from '@/sdk/contracts';
import demoData from '../fixtures/faculty.json';
import { matchesText, normalizeText, parseEntries } from '../domain';

/** Synthetic records for tests only; production uses integrations/faculty.ts. */
export interface FacultySourceAdapter { load(signal?: AbortSignal): Promise<unknown> }
export class StaticFacultyAdapter implements FacultySourceAdapter {
  constructor(private readonly data: unknown = demoData) {}
  async load(signal?: AbortSignal) { signal?.throwIfAborted(); return structuredClone(this.data); }
}
export class UnconfiguredFacultyAdapter implements FacultySourceAdapter {
  async load(signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();
    throw new Error('真实导师资料尚未接入。可以切换到演示数据体验搜索，稍后再连接公开资料接口。');
  }
}
export function createFacultyRepository(adapter: FacultySourceAdapter) {
  async function read(signal?: AbortSignal) {
    signal?.throwIfAborted();
    const data = await adapter.load(signal);
    signal?.throwIfAborted();
    try { return parseEntries(data); } catch { throw new Error('导师资料格式或来源校验失败，请核对数据后重试。'); }
  }
  async function searchEntries(query: FacultySearchQuery, signal?: AbortSignal) {
    const entries = (await read(signal)).filter(entry => matchesText(entry, query.text) &&
      (!query.institution || normalizeText(entry.faculty.institution).includes(normalizeText(query.institution))) &&
      (!query.researchAreas?.length || query.researchAreas.some(area => entry.faculty.researchAreas.includes(area))));
    const limit = query.limit == null ? entries.length : Math.max(0, Math.min(entries.length, Math.floor(query.limit) || 0));
    return entries.slice(0, limit);
  }
  async function getEntry(id: string, signal?: AbortSignal) { return (await read(signal)).find(entry => entry.faculty.id === id) ?? null; }
  const provider: FacultyProvider = {
    async search(query, signal) { return (await searchEntries(query, signal)).map(entry => entry.faculty); },
    async getById(id, signal) { return (await getEntry(id, signal))?.faculty ?? null; },
  };
  return { provider, searchEntries, getEntry };
}
export const demoRepository = createFacultyRepository(new StaticFacultyAdapter());
export const pendingRepository = createFacultyRepository(new UnconfiguredFacultyAdapter());
