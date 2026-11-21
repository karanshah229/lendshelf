import { useEffect, useState } from 'react';

import { rankCatalogueResults } from '@/lib/search';

import { searchOpenLibrary, type OlSearchResult } from './open-library';

export interface OlSearchState {
  /** The query the results belong to (trimmed). */
  query: string;
  results: OlSearchResult[];
  loading: boolean;
  error: string | null;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 400;

/**
 * Debounced Open Library search. Results are re-ranked so exact title + author matches come
 * first and summaries / study guides sink (C13). Stale responses are dropped (each new query aborts the
 * previous request). `retry()` re-runs the current query.
 */
export function useOlSearch(raw: string): OlSearchState & { retry(): void } {
  const query = raw.trim();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<OlSearchState, 'loading'> & { done: boolean }>({
    query: '',
    results: [],
    error: null,
    done: true,
  });

  useEffect(() => {
    if (query.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchOpenLibrary(query, controller.signal)
        .then((results) =>
          setState({
            query,
            results: rankCatalogueResults(results, query),
            error: null,
            done: true,
          })
        )
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            query,
            results: [],
            error:
              e instanceof Error && /fetch|network/i.test(e.message)
                ? 'Can’t reach the book catalogue. Check your connection.'
                : 'The book catalogue didn’t answer. Try again in a moment.',
            done: true,
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);

  const active = query.length >= MIN_CHARS;
  const current = active && state.query === query;
  return {
    query,
    // While a new query loads, keep showing the previous results.
    results: active ? state.results : [],
    loading: active && (!current || !state.done),
    error: current ? state.error : null,
    retry: () => {
      setState((s) => ({ ...s, query: '', done: false }));
      setAttempt((a) => a + 1);
    },
  };
}
