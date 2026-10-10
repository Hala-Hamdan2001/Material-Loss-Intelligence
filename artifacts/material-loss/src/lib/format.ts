import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

export * from './format-shared';

const CODES = [
  'INVALID_INPUT', 'INVALID_WEIGHT', 'REQUIRED_FIELDS', 'ZERO_ISSUED', 'UNBALANCED', 'DUPLICATE_REFERENCE',
  'CLOSED_JOB', 'STALE_REVISION', 'NOT_FOUND', 'UNAUTHORIZED', 'INVALID_COMPARISON', 'NOTE_REQUIRED',
  'SERVER_ERROR', 'RATE_LIMIT', 'FORBIDDEN', 'LAST_MANAGER', 'INVALID_ASSIGNEE',
];

export function errorCode(err: unknown): string {
  const e = err as { data?: { error?: unknown } | null; status?: number } | null;
  const code = e?.data && typeof e.data.error === 'string' ? e.data.error : undefined;
  if (code && CODES.includes(code)) return code;
  if (e?.status === 429) return 'RATE_LIMIT';
  if (e?.status === 401) return 'UNAUTHORIZED';
  if (e?.status === 403) return 'FORBIDDEN';
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
      return typeof k === 'string' && (k.startsWith('/api/jobs') || k === '/api/workspaces' || k === '/api/workspace/members' || k.startsWith('/api/dashboard') || k.startsWith('/api/reference-data'));
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

/** Unsaved-draft registry so workspace switches can warn before discarding a form. */
let dirtyDrafts = 0;
export function markDraftDirty(delta: 1 | -1) { dirtyDrafts = Math.max(0, dirtyDrafts + delta); }
export function hasDirtyDraft() { return dirtyDrafts > 0; }

/** Removes all workspace-scoped cached data, keeping only the given workspace record. */
export function clearScopedData(qc: QueryClient) {
  void qc.cancelQueries({ predicate: (q) => q.queryKey[0] !== '/api/workspace' });
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== '/api/workspace' });
  qc.getMutationCache().clear();
}
