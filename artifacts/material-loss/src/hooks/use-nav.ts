import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { buildHref, checkRange, recallScroll, rememberScroll, returnFromSearch, type RangeCheck } from '@/lib/nav';

/** URL-backed state for a fixed set of query keys. Writes use `replace` so typing doesn't spam history. */
export function useUrlParams<K extends string>(keys: readonly K[]) {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const keysRef = useRef(keys);
  const values = useMemo(() => {
    const sp = new URLSearchParams(search);
    const out = {} as Record<K, string>;
    for (const k of keysRef.current) out[k] = sp.get(k) ?? '';
    return out;
  }, [search]);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const set = useCallback(
    (patch: Partial<Record<K, string>>, opts: { push?: boolean } = {}) => {
      const next: Record<string, string | undefined> = { ...valuesRef.current, ...patch };
      navigate(buildHref(location, next), { replace: !opts.push });
    },
    [location, navigate],
  );
  /** The current in-app URL (path + query), suitable as a `back` target. */
  const here = buildHref(location, values);
  return { values, set, here };
}

/**
 * Validates a from/to range. Only valid ranges are returned as `active`; while
 * the range is invalid the last valid one stays active and is reported so the UI
 * can label figures honestly instead of firing 400 requests.
 */
export function useValidRange(from: string, to: string) {
  const check: RangeCheck = checkRange(from, to);
  const last = useRef<{ from: string; to: string }>({ from: '', to: '' });
  const initialised = useRef(false);
  if (check.ok) {
    last.current = { from: check.from, to: check.to };
    initialised.current = true;
  }
  return { check, active: last.current, stale: !check.ok, hadValid: initialised.current };
}

/** Validated source page (from `?back=`) for context-aware back links. */
export function useBackTarget() {
  const search = useSearch();
  return useMemo(() => returnFromSearch(search), [search]);
}

/** Restore window scroll for `key` once `ready`, and remember it when leaving. */
export function useScrollMemory(key: string, ready: boolean) {
  const restored = useRef<string | null>(null);
  const keyRef = useRef(key);
  keyRef.current = key;
  // useEffect (not layout) so it runs after the shell's scroll-to-top on route change.
  useEffect(() => {
    if (!ready || restored.current === key) return;
    restored.current = key;
    const y = recallScroll(key);
    if (y !== null) window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
  }, [ready, key]);
  // Track continuously: reading scrollY during unmount can be clamped by the DOM swap.
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => rememberScroll(keyRef.current, window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, [ready]);
  return useCallback(() => rememberScroll(keyRef.current, window.scrollY), []);
}
