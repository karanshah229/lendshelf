/**
 * Small realtime Firestore hooks. Subscriptions are keyed by a string so callers can build
 * refs/queries inline without re-subscribing every render. Results are stored with the key
 * they belong to, so `loading` is derived (true until the current key's first snapshot).
 */
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';

import { db, doc, onSnapshot, type query } from '@/lib/firebase';
import { fromQuerySnap, fromSnap, type WithId } from '@/types/model';

export type FirestoreQuery = ReturnType<typeof query>;

export interface DocResult<T> {
  data: WithId<T> | null;
  loading: boolean;
  error: Error | null;
}

export interface ListResult<T> {
  data: WithId<T>[];
  loading: boolean;
  error: Error | null;
  /** Subscribes again (a listener stops for good after an error); `loading` until it answers. */
  retry(): void;
}

interface Keyed<V> {
  key: string;
  value: V;
  error: Error | null;
}

const EMPTY: never[] = [];

/** Live document at `path` (e.g. `works/ol_OL1W`). Pass `null` to skip. */
export function useDocData<T>(path: string | null): DocResult<T> {
  const [state, setState] = useState<Keyed<WithId<T> | null> | null>(null);

  useEffect(() => {
    if (!path) return;
    return onSnapshot(
      doc(db, path),
      (snap) => setState({ key: path, value: fromSnap<T>(snap), error: null }),
      (error) => setState({ key: path, value: null, error })
    );
  }, [path]);

  const current = !!path && state?.key === path;
  return {
    data: current ? state.value : null,
    loading: !!path && !current,
    error: current ? state.error : null,
  };
}

/**
 * Live query results. `key` identifies the query (change it when the query changes);
 * pass `null` to skip. `build` is called when the key changes.
 */
export function useQueryData<T>(key: string | null, build: () => FirestoreQuery): ListResult<T> {
  const [state, setState] = useState<Keyed<WithId<T>[]> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const buildQuery = useEffectEvent(build);

  useEffect(() => {
    if (!key) return;
    return onSnapshot(
      buildQuery(),
      (snap) => setState({ key, value: fromQuerySnap<T>(snap), error: null }),
      (error) => setState({ key, value: [], error })
    );
  }, [key, attempt]);

  const retry = useCallback(() => {
    setState(null);
    setAttempt((a) => a + 1);
  }, []);

  const current = !!key && state?.key === key;
  return {
    data: current ? state.value : EMPTY,
    loading: !!key && !current,
    error: current ? state.error : null,
    retry,
  };
}

/**
 * Several live queries merged into one list (e.g. one query per linked owner).
 * `keys` identify the queries; `build(key)` creates each one. Pass `null` to skip.
 */
export function useMergedQueries<T>(
  keys: readonly string[] | null,
  build: (key: string) => FirestoreQuery
): ListResult<T> & { errors: Record<string, Error> } {
  const [results, setResults] = useState<
    Record<string, { value: WithId<T>[]; error: Error | null }>
  >({});
  const [attempt, setAttempt] = useState(0);
  const buildQuery = useEffectEvent(build);
  const joined = keys ? [...new Set(keys)].sort().join('|') : null;

  useEffect(() => {
    if (!joined) return;
    const unsubs = joined.split('|').map((key) =>
      onSnapshot(
        buildQuery(key),
        (snap) =>
          setResults((m) => ({ ...m, [key]: { value: fromQuerySnap<T>(snap), error: null } })),
        (error) => setResults((m) => ({ ...m, [key]: { value: [], error } }))
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [joined, attempt]);

  const retry = useCallback(() => {
    setResults({});
    setAttempt((a) => a + 1);
  }, []);

  return useMemo(() => {
    const list = joined ? joined.split('|') : [];
    const data: WithId<T>[] = [];
    const errors: Record<string, Error> = {};
    let loading = false;
    for (const key of list) {
      const r = results[key];
      if (!r) {
        loading = true;
        continue;
      }
      data.push(...r.value);
      if (r.error) errors[key] = r.error;
    }
    return { data, loading, error: Object.values(errors)[0] ?? null, errors, retry };
  }, [joined, results, retry]);
}
