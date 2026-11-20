import { useCallback, useEffect, useState } from 'react';

import { searchCatalogue, type CatalogueResult } from '@/features/discover/catalogue';

export type CatalogueSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; results: CatalogueResult[] }
  | { status: 'error' };

const DEBOUNCE_MS = 450;
export const CATALOGUE_MIN_LENGTH = 2;

/** Debounced Open Library search. Pass `enabled: false` to skip. */
export function useCatalogueSearch(
  query: string,
  enabled: boolean
): { state: CatalogueSearchState; retry(): void } {
  const q = query.trim();
  const active = enabled && q.length >= CATALOGUE_MIN_LENGTH;
  const [result, setResult] = useState<{ key: string; value: CatalogueSearchState } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCatalogue(q, controller.signal)
        .then((results) => setResult({ key: q, value: { status: 'done', results } }))
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === 'AbortError') return;
          setResult({ key: q, value: { status: 'error' } });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, active, attempt]);

  const retry = useCallback(() => {
    setResult(null);
    setAttempt((a) => a + 1);
  }, []);

  const state: CatalogueSearchState = !active
    ? { status: 'idle' }
    : result?.key !== q
      ? { status: 'loading' }
      : result.value;
  return { state, retry };
}
