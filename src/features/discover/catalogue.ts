/**
 * Open Library catalogue search, called from the device when nothing in your circle matches.
 * https://openlibrary.org/dev/docs/api/search
 */

export interface CatalogueResult {
  /** Open Library work key without the prefix, e.g. "OL45804W". */
  olWorkKey: string;
  /** The LendShelf Book id this resolves to (`ol_<key>`). */
  workId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  /** First ISBN Open Library lists (helps resolveBook pick an edition). */
  isbn: string | null;
}

const FIELDS = 'key,title,author_name,cover_i,first_publish_year,isbn';

export function catalogueSearchUrl(query: string, limit = 20): string {
  return `https://openlibrary.org/search.json?q=${encodeURIComponent(query.trim())}&fields=${FIELDS}&limit=${limit}`;
}

export const olWorkId = (olWorkKey: string) => `ol_${olWorkKey}`;

export function olCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'M'): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

interface RawDoc {
  key?: unknown;
  title?: unknown;
  author_name?: unknown;
  cover_i?: unknown;
  first_publish_year?: unknown;
  isbn?: unknown;
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Parses a search.json response; skips anything that isn't a work with a title. */
export function parseCatalogueResults(json: unknown): CatalogueResult[] {
  const docs = (json as { docs?: unknown })?.docs;
  if (!Array.isArray(docs)) return [];
  const out: CatalogueResult[] = [];
  const seen = new Set<string>();
  for (const raw of docs as RawDoc[]) {
    if (!raw || !isString(raw.key) || !isString(raw.title)) continue;
    const match = /^\/works\/(OL\d+W)$/.exec(raw.key);
    if (!match) continue;
    const olWorkKey = match[1]!;
    if (seen.has(olWorkKey)) continue;
    seen.add(olWorkKey);
    const authors = Array.isArray(raw.author_name) ? raw.author_name.filter(isString) : [];
    const isbns = Array.isArray(raw.isbn) ? raw.isbn.filter(isString) : [];
    out.push({
      olWorkKey,
      workId: olWorkId(olWorkKey),
      title: raw.title,
      authors: [...new Set(authors)].slice(0, 3),
      coverUrl: typeof raw.cover_i === 'number' && raw.cover_i > 0 ? olCoverUrl(raw.cover_i) : null,
      firstPublishYear: typeof raw.first_publish_year === 'number' ? raw.first_publish_year : null,
      // Prefer an ISBN-13.
      isbn: isbns.find((i) => i.length === 13) ?? isbns[0] ?? null,
    });
  }
  return out;
}

/** Searches the Open Library catalogue. Throws on network/HTTP errors (and AbortError). */
export async function searchCatalogue(
  query: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch
): Promise<CatalogueResult[]> {
  const res = await fetchImpl(catalogueSearchUrl(query), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Open Library search failed (${res.status})`);
  return parseCatalogueResults(await res.json());
}
