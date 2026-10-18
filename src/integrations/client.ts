import { useEffect, useState } from 'react';
import { getServiceCredential } from '@/app/services/db';
import type { AiGenerateRequest, AiGenerateResponse } from '@/sdk/contracts';

export type ServiceKind = 'ai' | 'search';
export interface Preset { id: string; name: string; base_url: string; model?: string; models?: string[]; docs: string; protocol?: string; key_optional?: boolean }
export interface ServiceConfig { base_url: string; model?: string; max_tokens?: number; max_results?: number; persist_key: boolean; has_key: boolean; ready: boolean }
export interface ServiceSettings { active: Record<ServiceKind, string>; ai: Record<string, ServiceConfig>; search: Record<string, ServiceConfig> }
export interface Source { id: string; name: string; documentation?: string; endpoint?: string; urls?: string[]; coverage_note: string }
export interface Presets { ai: Preset[]; search: Preset[]; sources: Source[] }
export interface SearchHit { title: string; url: string; snippet: string }
export interface SearchResponse { results: SearchHit[]; provider: string; searched_at: string }

export async function localRequest<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('Only the local API can receive account credentials');
  const token = await getServiceCredential(userId);
  const controller = new AbortController();
  const abort = () => controller.abort();
  const parent = init.signal;
  parent?.addEventListener('abort', abort, {once: true});
  if (parent?.aborted) controller.abort();
  const timer = setTimeout(abort, 90000);
  try {
    const response = await fetch(path, {...init, signal: controller.signal, credentials: 'same-origin', headers: {
      ...(init.body && typeof init.body === 'string' ? {'Content-Type': 'application/json'} : {}),
      ...Object.fromEntries(new Headers(init.headers).entries()),
      'X-ResearchSpace-User': userId, 'X-ResearchSpace-Token': token,
    }});
    const data = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : null;
      throw new Error(typeof detail === 'string' ? detail : `Local API error (HTTP ${response.status})`);
    }
    if (!data || typeof data !== 'object') throw new Error('本地服务响应无效 / Invalid local server response');
    return data as T;
  } catch (error) {
    if (error instanceof TypeError) throw new Error('无法连接本地服务，请运行 python run.py / Start the local Python server');
    throw error;
  } finally { clearTimeout(timer); parent?.removeEventListener('abort', abort); }
}

export function settingsChanged(userId: string) { window.dispatchEvent(new CustomEvent('researchspace:services', {detail: userId})); }
export function useServiceSettings(userId: string) {
  const [state, setState] = useState<{userId: string; data: ServiceSettings | null; error: string}>({userId, data: null, error: ''});
  useEffect(() => {
    let alive = true;
    let controller = new AbortController();
    const refresh = () => {
      controller.abort(); controller = new AbortController(); const current = controller;
      void localRequest<ServiceSettings>(userId, '/api/settings', {signal: current.signal}).then(data => {
        if (alive && !current.signal.aborted) setState({userId, data, error: ''});
      }).catch(e => {if (alive && !current.signal.aborted) setState({userId, data: null, error: String(e.message || e)});});
    };
    refresh();
    const listener = (e: Event) => { if ((e as CustomEvent<string>).detail === userId) refresh(); };
    window.addEventListener('researchspace:services', listener);
    return () => { alive = false; controller.abort(); window.removeEventListener('researchspace:services', listener); };
  }, [userId]);
  return state.userId === userId ? state : {userId, data: null, error: ''};
}

export function userAi(userId: string, ready: boolean) {
  return {state: ready ? 'ready' as const : 'unconfigured' as const,
    async generate(request: AiGenerateRequest, signal?: AbortSignal): Promise<AiGenerateResponse> {
      if (request.containsPersonalData && !request.personalDataConsent) throw new Error('尚未同意向外部 AI 发送个人资料');
      const response = await localRequest<AiGenerateResponse>(userId, '/api/ai/generate', {method: 'POST', body: JSON.stringify(request), signal});
      if (typeof response.text !== 'string' || response.mode !== 'live') throw new Error('AI response format is invalid');
      return response;
    }};
}
