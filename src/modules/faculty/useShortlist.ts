import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { ScopedUserStorage } from '@/sdk/contracts';

const noteSchema = z.object({
  saved: z.boolean(), questions: z.string().max(4000), note: z.string().max(4000),
  preparation: z.enum(['exploring', 'reading', 'ready']), updatedAt: z.string(),
});
const savedSchema = z.object({ version: z.literal(1), entries: z.record(z.string(), noteSchema) });
export type CandidateNote = z.infer<typeof noteSchema>;
export const emptyNote: CandidateNote = { saved: false, questions: '', note: '', preparation: 'exploring', updatedAt: '' };
const storageKey = 'candidate-list.v1';
export function useShortlist(storage: ScopedUserStorage) {
  const [entries, setEntries] = useState<Record<string, CandidateNote>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(false);
  const locked = useRef(false);
  const current = useRef(entries);
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setLoading(true); setError('');
    storage.get<unknown>(storageKey).then(value => {
      if (cancelled) return;
      const next = value == null ? {} : savedSchema.parse(value).entries;
      current.current = next; setEntries(next);
    }).catch(() => { if (!cancelled) setError('未能读取当前账户的候选清单，请重试。原有记录未被覆盖。'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; alive.current = false; };
  }, [storage, attempt]);
  async function update(id: string, patch: Partial<CandidateNote>) {
    if (locked.current || loading || error) return false;
    locked.current = true; setBusy(true);
    const next = { ...current.current, [id]: { ...(current.current[id] ?? emptyNote), ...patch, updatedAt: new Date().toISOString() } };
    try {
      await storage.set(storageKey, savedSchema.parse({ version: 1, entries: next }));
      if (alive.current) { current.current = next; setEntries(next); }
      return true;
    } catch {
      if (alive.current) setError('保存失败，尚未写入候选清单。请重试读取后再保存；页面中的编辑内容会保留。');
      return false;
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  return { entries, loading, busy, error, update, retry: () => setAttempt(value => value + 1) };
}
export type Shortlist = ReturnType<typeof useShortlist>;
