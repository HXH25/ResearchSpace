import { z } from 'zod';
import type { FacultyProvider } from '@/sdk/contracts';
import { parseEntries } from '@/modules/faculty/domain';
import { localRequest } from './client';

const listSchema = z.object({items: z.array(z.unknown()), total: z.number(), page: z.number(), page_size: z.number(), source: z.string(),
  catalog_total: z.number().optional(), departments: z.array(z.string()).default([]), institutions: z.array(z.string()).default([]), query_used: z.string().optional(), total_kind: z.string().optional()});
export function createFacultyClient(userId: string) {
  return {
    async search(params: URLSearchParams, signal?: AbortSignal) {
      const data = listSchema.parse(await localRequest(userId, '/api/faculty?' + params, {signal}));
      return {...data, items: parseEntries(data.items)};
    },
    async getEntry(id: string, signal?: AbortSignal) {
      const data = await localRequest(userId, '/api/faculty/' + encodeURIComponent(id), {signal});
      return parseEntries([data])[0];
    },
  };
}
export function createFacultyProvider(userId: string): FacultyProvider {
  const client = createFacultyClient(userId);
  return {
    async search(query, signal) {
      const params = new URLSearchParams({q: query.text || '', page_size: String(Math.max(1, Math.min(query.limit ?? 30, 100)))});
      if (query.institution) params.set('institution', query.institution);
      if (query.researchAreas?.length === 1) params.set('area', query.researchAreas[0]);
      const data = await client.search(params, signal);
      return data.items.map(e => e.faculty).filter(f => !query.researchAreas?.length || query.researchAreas.some(a => f.researchAreas.includes(a))).slice(0, query.limit ?? 30);
    },
    async getById(id, signal) { return (await client.getEntry(id, signal)).faculty; },
  };
}
