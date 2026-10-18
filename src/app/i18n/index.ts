import { useCallback } from 'react';
import { getUiPreferences, useUiPreferences, type UiLocale } from '@/app/preferences/store';
import { english } from './en';

export type MessageParams = Record<string, string | number>;
// A notice may remain visible while the language changes. Resolve previously
// rendered notices back to their source key rather than freezing their language.
const sourceByEnglish = new Map(Object.entries(english).map(([source, target]) => [target, source]));
/** Only interface copy is translated. Student input and source records stay verbatim. */
export function translate(message: string | undefined, params?: MessageParams, locale: UiLocale = getUiPreferences().locale): string {
  if (message == null) return '';
  const source = Object.hasOwn(english, message) ? message : (sourceByEnglish.get(message) ?? message);
  const result = locale === 'en' ? (english[source] ?? source) : source;
  return result.replace(/\{(\w+)\}/g, (match, key: string) => params?.[key] == null ? match : String(params[key]));
}
export function useI18n() {
  const { locale } = useUiPreferences();
  const t = useCallback((message: string | undefined, params?: MessageParams) => translate(message, params, locale), [locale]);
  return { t, locale };
}
