/**
 * Open Library title/author search, called directly from the app (no key needed).
 * Picking a result goes through `api.resolveBook({ olWorkKey })`, which creates the Book.
 */
import { likelyCatalogueMatches } from '@/lib/search';

export const OL_SEARCH_URL = 'https://openlibrary.org/search.json';
const FIELDS = 'key,title,author_name,cover_i,first_publish_year,isbn,edition_count';

export interface OlSearchResult {
  /** e.g. "OL45804W" */
  workKey: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  editionCount: number;
}

export function olSearchUrl(query: string, limit = 20): string {
  const params = [`q=${encodeURIComponent(query.trim())}`, `fields=${FIELDS}`, `limit=${limit}`];
  return `${OL_SEARCH_URL}?${params.join('&')}`;
}

/** "OL45804W" from "/works/OL45804W"; null for anything else. */
export function olWorkKey(key: unknown): string | null {
  if (typeof key !== 'string') return null;
  const m = /^(?:\/?works\/)?(OL\d+W)$/i.exec(key.trim());
  return m ? (m[1] as string).toUpperCase() : null;
}

export function olCoverUrl(coverId: unknown, size: 'S' | 'M' | 'L' = 'M'): string | null {
  return typeof coverId === 'number' && coverId > 0
    ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
    : null;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];

/** Parses an Open Library search response, dropping docs without a work key or title. */
export function parseOlSearch(json: unknown): OlSearchResult[] {
  const docs = (json as { docs?: unknown })?.docs;
  if (!Array.isArray(docs)) return [];
  const seen = new Set<string>();
  const out: OlSearchResult[] = [];
  for (const raw of docs) {
    const d = raw as Record<string, unknown>;
    const workKey = olWorkKey(d.key);
    const title = typeof d.title === 'string' ? d.title.trim() : '';
    if (!workKey || !title || seen.has(workKey)) continue;
    seen.add(workKey);
    out.push({
      workKey,
      title,
      // Open Library repeats authors on some works.
      authors: [...new Set(strings(d.author_name))].slice(0, 5),
      coverUrl: olCoverUrl(d.cover_i),
      firstPublishYear: typeof d.first_publish_year === 'number' ? d.first_publish_year : null,
      editionCount: typeof d.edition_count === 'number' ? d.edition_count : 0,
    });
  }
  return out;
}

export async function searchOpenLibrary(
  query: string,
  signal?: AbortSignal
): Promise<OlSearchResult[]> {
  const res = await fetch(olSearchUrl(query), { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Open Library search failed (${res.status})`);
  return parseOlSearch(await res.json());
}

/**
 * "Is it one of these?" before saving a hand-entered book (C13, E8): catalogue records with the
 * same main title as what was typed (summaries and guides left out), matching authors first.
 * Searches "title author" first and falls back to the title alone. Throws on network errors.
 */
export async function findCatalogueMatches(
  typed: { title: string; authors: readonly string[] },
  {
    signal,
    search = searchOpenLibrary,
    limit = 3,
  }: {
    signal?: AbortSignal;
    search?: (query: string, signal?: AbortSignal) => Promise<OlSearchResult[]>;
    limit?: number;
  } = {}
): Promise<OlSearchResult[]> {
  const title = typed.title.trim();
  if (!title) return [];
  const author = typed.authors[0]?.trim();
  const queries = author ? [`${title} ${author}`, title] : [title];
  for (const q of queries) {
    const matches = likelyCatalogueMatches(await search(q, signal), typed, limit);
    if (matches.length) return matches;
  }
  return [];
}
