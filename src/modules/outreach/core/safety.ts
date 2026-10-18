import type { Diagnostic } from '../types';

export class OutreachError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'OutreachError'; }
}
export function fail(code: string, message: string): never { throw new OutreachError(code, message); }
export function clean(value: string, maximum = 1000): string { return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maximum); }
export function httpUrl(value: string): string | null {
  try { const u = new URL(value); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function email(value: string): string { return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) && value.length <= 254 ? value : ''; }
export function recent(iso: string | undefined, days = 90, now = Date.now()): boolean {
  const t = Date.parse(iso || ''); return Number.isFinite(t) && t <= now + 300000 && now - t <= days * 86400000;
}
export function checkpoint(signal?: AbortSignal, isCurrent: () => boolean = () => true) {
  if (signal?.aborted || !isCurrent()) throw new OutreachError('CANCELLED', '任务已取消，或当前账号／画像已变化。');
}
// Do not surface exception messages from network providers, model replies or storage drivers.
export function diagnostic(error: unknown, fallback = '操作未完成，已有草稿已保留。'): Diagnostic {
  if (error instanceof OutreachError) return { code: error.code, message: error.message, level: 'warning' };
  return { code: 'OPERATION_FAILED', message: fallback, level: 'error' };
}
export function isAbort(error: unknown) { return error instanceof DOMException && error.name === 'AbortError'; }
