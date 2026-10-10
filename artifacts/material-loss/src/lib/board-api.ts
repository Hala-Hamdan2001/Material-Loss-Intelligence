import { useQuery } from '@tanstack/react-query';
import type { Job } from '@workspace/api-client-react';

export type Board = { jobs: Job[]; investigation: Job[]; closed: Job[] };

/** Error shaped like the generated client's errors so errorCode() can read it. */
export class HttpError extends Error {
  status: number;
  data: { error?: unknown } | null;
  constructor(status: number, data: { error?: unknown } | null) {
    super(`HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
}

async function failure(res: Response): Promise<HttpError> {
  let data: { error?: unknown } | null = null;
  try { data = await res.json(); } catch { data = null; }
  return new HttpError(res.status, data);
}

export const BOARD_KEY = ['/api/jobs/board'] as const;

export function useBoard() {
  return useQuery<Board>({
    queryKey: BOARD_KEY,
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/jobs/board', { credentials: 'include', signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw await failure(res);
      const b = (await res.json()) as Partial<Board>;
      if (!Array.isArray(b.jobs) || !Array.isArray(b.investigation) || !Array.isArray(b.closed)) throw new Error('Invalid board response');
      return b as Board;
    },
  });
}

/** Download the jobs CSV for the given effective filters. */
export async function downloadJobsCsv(params: Record<string, string | undefined> | undefined, signal?: AbortSignal): Promise<void> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v);
  const qs = sp.toString();
  const res = await fetch(`/api/jobs/export.csv${qs ? `?${qs}` : ''}`, { credentials: 'include', signal, headers: { Accept: 'text/csv' } });
  if (!res.ok) throw await failure(res);
  const blob = await res.blob();
  signal?.throwIfAborted();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : `jobs-${new Date().toISOString().slice(0, 10)}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
