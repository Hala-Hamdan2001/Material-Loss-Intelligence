import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

export const SYSTEM_REASONS = ['setup_layout', 'damaged', 'unspecified_demo'] as const;
export const SELECTABLE_REASONS = ['setup_layout', 'damaged'] as const;

export function isSystemReason(r: string) {
  return (SYSTEM_REASONS as readonly string[]).includes(r);
}

/** Normalize Arabic-Indic / Persian digits and Arabic decimal separators to ASCII. */
export function normalizeDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, '.')
    .trim();
}

export type ParsedNum = { value: number; valid: boolean; empty: boolean };

export function parseWeight(raw: string): ParsedNum {
  let s = normalizeDigits(raw);
  if (s === '') return { value: 0, valid: true, empty: true };
  // ASCII commas are ambiguous (decimal vs thousands): always reject.
  if (s.includes(',')) return { value: 0, valid: false, empty: false };
  // Arabic thousands separator: accept only valid 3-digit grouping, then strip.
  if (s.includes('\u066C')) {
    if (!/^\d{1,3}(\u066C\d{3})+(\.\d{0,3})?$/.test(s)) return { value: 0, valid: false, empty: false };
    s = s.replace(/\u066C/g, '');
  }
  if (!/^\d+(\.\d{0,3})?$/.test(s) && !/^\.\d{1,3}$/.test(s)) return { value: 0, valid: false, empty: false };
  const v = Number(s);
  if (!Number.isFinite(v) || v > 100000000) return { value: 0, valid: false, empty: false };
  return { value: v, valid: true, empty: false };
}

export function useFmt() {
  const { i18n, t } = useTranslation();
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
  return useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
    const pf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
    const df = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const dtf = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return {
      lang,
      num: (v: number) => nf.format(v),
      kg: (v: number) => `${nf.format(v)} ${t('common.kg')}`,
      signedKg: (v: number) => `${v > 0 ? '+' : v < 0 ? '\u2212' : ''}${nf.format(Math.abs(v))} ${t('common.kg')}`,
      pct: (v: number) => `${pf.format(v)}\u066A`.replace('\u066A', lang === 'ar' ? '\u066A' : '%'),
      pp: (v: number) => pf.format(Math.abs(v)),
      date: (s: string) => df.format(new Date(s)),
      dateTime: (s: string) => dtf.format(new Date(s)),
    };
  }, [locale, lang, t]);
}

export const CLOSE_FIELDS = ['reference', 'product', 'material', 'machine'] as const;
export type CloseField = (typeof CLOSE_FIELDS)[number];
export function missingForClose(j: { reference: string; product: string; material: string; machine: string }): CloseField[] {
  return CLOSE_FIELDS.filter((k) => !j[k].trim());
}
export function useFieldList() {
  const { t, i18n } = useTranslation();
  return useCallback(
    (fields: readonly CloseField[]) => fields.map((f) => t(`form.${f}`)).join(i18n.language === 'ar' ? '\u060C ' : ', '),
    [t, i18n.language],
  );
}

export function useReasonLabel() {
  const { t } = useTranslation();
  return useCallback((r: string) => (isSystemReason(r) ? t(`reasons.${r}`) : r || t('common.emptyValue')), [t]);
}

const CODES = [
  'INVALID_INPUT', 'INVALID_WEIGHT', 'REQUIRED_FIELDS', 'ZERO_ISSUED', 'UNBALANCED', 'DUPLICATE_REFERENCE',
  'CLOSED_JOB', 'STALE_REVISION', 'NOT_FOUND', 'UNAUTHORIZED', 'INVALID_COMPARISON', 'NOTE_REQUIRED',
  'SERVER_ERROR', 'RATE_LIMIT',
];

export function errorCode(err: unknown): string {
  const e = err as { data?: { error?: unknown } | null; status?: number } | null;
  const code = e?.data && typeof e.data.error === 'string' ? e.data.error : undefined;
  if (code && CODES.includes(code)) return code;
  if (e?.status === 429) return 'RATE_LIMIT';
  if (e?.status === 401) return 'UNAUTHORIZED';
  if (e?.status === 404) return 'NOT_FOUND';
  return 'SERVER_ERROR';
}

export function useErrorText() {
  const { t } = useTranslation();
  return useCallback((err: unknown) => t(`errors.${errorCode(err)}`), [t]);
}

export function invalidateBusiness(qc: QueryClient) {
  return qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey[0];
      return typeof k === 'string' && (k.startsWith('/api/jobs') || k.startsWith('/api/dashboard') || k.startsWith('/api/reference-data'));
    },
  });
}

export function useInvalidateBusiness() {
  const qc = useQueryClient();
  return useCallback(() => invalidateBusiness(qc), [qc]);
}

export function cleanParams<T extends Record<string, string | undefined>>(p: T): Partial<T> | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (v) out[k] = v;
  return Object.keys(out).length ? (out as Partial<T>) : undefined;
}
