/** Framework-independent same-origin API client. No host SDK contract is redefined. */
export interface ResearchProfile {
  institution?: string; degree?: string; year?: number | null;
  interests?: string[]; skills?: string[]; experience?: string;
  work_types?: string[]; goals?: string[]; regions?: string[]; languages?: string[];
  hours_per_week?: number | null; start_date?: string; end_date?: string;
}
export interface Match {
  score: number; components: Record<string, number>; reasons: string[];
  conflicts: string[]; unknowns: string[]; preparations: string[];
  eligibility: 'conflict' | 'needs_check'; note: string;
}
export interface ResearchProject {
  id: string; title: string; description: string; institution: string;
  region: string; kind: string; mentors: string[]; team: string; period_text: string;
  eligibility_text: string; application_method: string; application_url: string;
  source_url: string; collected_at: string; effective_status: string;
  visibility: 'public' | 'private'; warnings: string[]; match?: Match;
}
export interface Page { items: ResearchProject[]; total: number; page: number; page_size: number }
export interface Filters {
  q?: string; region?: string; institution?: string; kind?: string; status?: string;
  source_id?: string; hide_conflicts?: boolean; page?: number; page_size?: number;
}
export function researchClient(base = '/api') {
  async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST', signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data as T;
  }
  return {
    search: (filters: Filters = {}, signal?: AbortSignal) => request<Page>('/projects?' + new URLSearchParams(Object.entries(filters).map(([k,v]) => [k,String(v)])), undefined, signal),
    recommend: (profile: ResearchProfile, filters: Filters = {}, signal?: AbortSignal) => request<Page>('/recommend', {profile,filters}, signal),
    detail: (id: string, signal?: AbortSignal) => request<ResearchProject>('/projects/' + encodeURIComponent(id), undefined, signal),
  };
}
