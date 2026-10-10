/**
 * Pure navigation helpers: safe return paths, date-range validation and
 * in-memory (never persisted) scroll memory scoped to the active workspace.
 * No record data is ever stored here.
 */

/** Only these in-app list surfaces may be used as a "back" destination. */
const RETURN_PATHS = new Set(['/', '/jobs']);
const RETURN_KEYS: Record<string, readonly string[]> = {
  // Workers use the Jobs screen at "/" as well as at "/jobs".
  '/': ['from', 'to', 'search', 'machine', 'material', 'status'],
  '/jobs': ['search', 'from', 'to', 'machine', 'material', 'status'],
};

/**
 * Validate a candidate return URL. Accepts only `/` or `/jobs` with a whitelisted
 * query string; rejects absolute/protocol-relative/backslash URLs and job paths.
 */
export function safeReturn(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string' || raw.length > 600) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\u0000-\u001f]/.test(raw)) return null;
  const q = raw.indexOf('?');
  const path = q === -1 ? raw : raw.slice(0, q);
  if (!RETURN_PATHS.has(path)) return null;
  if (q === -1) return path;
  const input = new URLSearchParams(raw.slice(q + 1));
  const out = new URLSearchParams();
  for (const k of RETURN_KEYS[path]) {
    const v = input.get(k);
    if (v) out.set(k, v.slice(0, 200));
  }
  const s = out.toString();
  return s ? `${path}?${s}` : path;
}

/** Read `back` from a search string and validate it. */
export function returnFromSearch(search: string): string | null {
  return safeReturn(new URLSearchParams(search).get('back'));
}

/** Append a validated `back` param to an in-app href. */
export function withBack(href: string, back: string | null | undefined): string {
  const safe = safeReturn(back);
  if (!safe) return href;
  return `${href}${href.includes('?') ? '&' : '?'}back=${encodeURIComponent(safe)}`;
}

/** Build `path?query` from a record, dropping empty values. */
export function buildHref(path: string, params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `${path}?${s}` : path;
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 1900 && y <= 2999;
}

export type RangeCheck =
  | { ok: true; from: string; to: string }
  | { ok: false; reason: 'bad_date' | 'order' };

/** Empty bounds are open-ended and valid. */
export function checkRange(from: string, to: string): RangeCheck {
  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) return { ok: false, reason: 'bad_date' };
  if (from && to && from > to) return { ok: false, reason: 'order' };
  return { ok: true, from, to };
}

/* ---------- scroll memory (in-memory only, scoped by workspace) ---------- */

let navScope: string | null = null;
const scrollMemory = new Map<string, number>();

/** Set the active workspace scope; any change clears all remembered positions. */
export function setNavScope(scope: string | null): void {
  if (scope !== navScope) scrollMemory.clear();
  navScope = scope;
}
export function clearNavMemory(): void {
  scrollMemory.clear();
}
export function rememberScroll(key: string, y: number): void {
  if (navScope === null) return;
  scrollMemory.set(`${navScope}\u0001${key}`, Math.max(0, Math.round(y)));
  if (scrollMemory.size > 40) scrollMemory.delete(scrollMemory.keys().next().value as string);
}
export function recallScroll(key: string): number | null {
  if (navScope === null) return null;
  const v = scrollMemory.get(`${navScope}\u0001${key}`);
  return v === undefined ? null : v;
}
export function navMemorySize(): number {
  return scrollMemory.size;
}
