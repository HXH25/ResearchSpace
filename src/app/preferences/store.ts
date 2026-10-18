import { useSyncExternalStore } from 'react';

export const PREFERENCES_KEY = 'researchspace:ui-preferences:v1';
export const THEMES = ['forest', 'ocean', 'violet', 'rose', 'amber'] as const;
export type ThemeId = typeof THEMES[number];
export type UiLocale = 'zh-CN' | 'en';
export interface UiPreferences { theme: ThemeId; locale: UiLocale }
const defaults: UiPreferences = { theme: 'forest', locale: 'zh-CN' };

export function parsePreferences(raw: string | null): UiPreferences {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return { ...defaults };
    const p = value as Partial<UiPreferences>;
    return {
      theme: THEMES.includes(p.theme as ThemeId) ? p.theme as ThemeId : defaults.theme,
      locale: p.locale === 'en' ? 'en' : defaults.locale,
    };
  } catch { return { ...defaults }; }
}
function load(): UiPreferences {
  try { return parsePreferences(localStorage.getItem(PREFERENCES_KEY)); }
  catch { return { ...defaults }; }
}
let current = load();
const listeners = new Set<() => void>();
export const getUiPreferences = () => current;
const serverSnapshot = () => defaults;
const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
};

function applyDocument(p: UiPreferences) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = p.theme;
  document.documentElement.lang = p.locale;
  document.title = p.locale === 'en' ? 'ResearchSpace · Undergraduate research' : 'ResearchSpace · 本科生科研空间';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',
    { forest:'#1b5341', ocean:'#205c85', violet:'#63408b', rose:'#8b405f', amber:'#825721' }[p.theme]);
}

export function setUiPreferences(patch: Partial<UiPreferences>) {
  const next = parsePreferences(JSON.stringify({ ...current, ...patch }));
  if (next.locale === current.locale && next.theme === current.theme) return;
  current = next;
  applyDocument(current);
  try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(current)); } catch { /* Keep working for this visit. */ }
  listeners.forEach((callback) => callback());
}
export function useUiPreferences() {
  return useSyncExternalStore(subscribe, getUiPreferences, serverSnapshot);
}

applyDocument(current);
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key !== PREFERENCES_KEY && event.key !== null) return;
  const next = parsePreferences(event.key === null ? null : event.newValue);
  if (next.locale === current.locale && next.theme === current.theme) return;
  current = next;
  applyDocument(current);
  listeners.forEach((callback) => callback());
});
