/**
 * On-device search across your own and your contacts' shared copies (SPEC §6 Discover).
 * Case- and diacritics-insensitive; results are grouped by Book (workId) and ranked.
 */

export interface SearchableCopy {
  workId: string;
  title: string;
  authors: string[];
}

export interface WorkGroup<T extends SearchableCopy> {
  workId: string;
  title: string;
  authors: string[];
  copies: T[];
  /** Higher is better. 0 when no query was given. */
  score: number;
}

/**
 * Lowercase, strip diacritics and punctuation, collapse whitespace. "Gabriel García-Márquez" →
 * "gabriel garcia marquez". Non-strings (malformed documents) normalise to "".
 */
export function normaliseText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokenize(value: string): string[] {
  const n = normaliseText(value);
  return n ? n.split(' ') : [];
}

/** Score how well one query token matches a field; 0 = no match. */
function fieldTokenScore(field: string, fieldWords: string[], token: string): number {
  if (!field.includes(token)) return 0;
  if (fieldWords.includes(token)) return 3; // whole word
  if (fieldWords.some((w) => w.startsWith(token))) return 2; // word prefix
  return 1; // substring
}

/**
 * Scores a work against a query. Every query token must match the title or an author,
 * otherwise the score is 0. Title matches outrank author matches; exact and prefix
 * matches of the whole title get a bonus.
 */
export function scoreWork(title: string, authors: readonly string[], query: string): number {
  const tokens = tokenize(query);
  if (!tokens.length) return 0;
  // Defensive: documents are typed, but a malformed one mustn't crash search.
  const names = Array.isArray(authors) ? authors.filter((au) => typeof au === 'string') : [];
  const t = normaliseText(title);
  const tWords = t.split(' ');
  const a = normaliseText(names.join(' '));
  const aWords = a.split(' ');
  const q = tokens.join(' ');

  let score = 0;
  for (const token of tokens) {
    const ts = fieldTokenScore(t, tWords, token);
    const as = fieldTokenScore(a, aWords, token);
    if (!ts && !as) return 0;
    score += Math.max(ts * 10, as * 6);
  }
  if (t === q) score += 100;
  else if (t.startsWith(q)) score += 50;
  else if (t.includes(q)) score += 20;
  if (a === q || names.some((au) => normaliseText(au) === q)) score += 40;
  return score;
}

/** Groups copies by workId, preserving first-seen order. */
export function groupByWork<T extends SearchableCopy>(copies: readonly T[]): WorkGroup<T>[] {
  const groups = new Map<string, WorkGroup<T>>();
  for (const copy of copies) {
    const g = groups.get(copy.workId);
    if (g) g.copies.push(copy);
    else
      groups.set(copy.workId, {
        workId: copy.workId,
        title: copy.title,
        authors: copy.authors,
        copies: [copy],
        score: 0,
      });
  }
  return [...groups.values()];
}

const byTitle = <T extends SearchableCopy>(a: WorkGroup<T>, b: WorkGroup<T>) =>
  normaliseText(a.title).localeCompare(normaliseText(b.title));

/**
 * Searches copies by title/author and returns matching Books, best first
 * (ties: more copies first, then title). An empty query returns every Book sorted by title.
 */
export function searchCopies<T extends SearchableCopy>(
  copies: readonly T[],
  query: string
): WorkGroup<T>[] {
  const groups = groupByWork(copies);
  if (!tokenize(query).length) return groups.sort(byTitle);
  return groups
    .map((g) => ({ ...g, score: scoreWork(g.title, g.authors, query) }))
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score || b.copies.length - a.copies.length || byTitle(a, b));
}

// ---------- Books across catalogue records (C9 / C13) ----------

/**
 * Key for "the same book" across catalogue records: normalised title + normalised first author.
 * Two works with the same key are treated as editions of one book on the client (the catalogue
 * sometimes files one book under several work ids). Copies with no author only match each other.
 */
export function bookKey(title: unknown, authors: unknown): string {
  const first = Array.isArray(authors) ? authors.find((a) => typeof a === 'string') : undefined;
  return `${normaliseText(title)}|${normaliseText(first)}`;
}

export interface BookGroup<T extends SearchableCopy> extends WorkGroup<T> {
  /** Every work id in the group; `workId` (the one with most copies) comes first. */
  workIds: string[];
}

/**
 * Groups copies by book (same normalised title + first author), merging copies filed under
 * different work ids. The group's `workId` is the work with the most copies (ties: first seen).
 */
export function groupByBook<T extends SearchableCopy>(copies: readonly T[]): BookGroup<T>[] {
  const groups = new Map<string, { title: string; authors: string[]; copies: T[] }>();
  for (const copy of copies) {
    const key = bookKey(copy.title, copy.authors);
    const g = groups.get(key);
    if (g) g.copies.push(copy);
    else groups.set(key, { title: copy.title, authors: copy.authors, copies: [copy] });
  }
  return [...groups.values()].map((g) => {
    const counts = new Map<string, number>();
    for (const c of g.copies) counts.set(c.workId, (counts.get(c.workId) ?? 0) + 1);
    // Map keeps insertion order, so a stable sort keeps first-seen order on ties.
    const workIds = [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
    return { ...g, workId: workIds[0]!, workIds, score: 0 };
  });
}

/**
 * Like `searchCopies`, but groups copies of the same book filed under different work ids into
 * one result (Home search shows those as "2 editions").
 */
export function searchBooks<T extends SearchableCopy>(
  copies: readonly T[],
  query: string
): BookGroup<T>[] {
  const groups = groupByBook(copies);
  if (!tokenize(query).length) return groups.sort(byTitle);
  return groups
    .map((g) => ({ ...g, score: scoreWork(g.title, g.authors, query) }))
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score || b.copies.length - a.copies.length || byTitle(a, b));
}

// ---------- Catalogue ranking (C13) ----------

export interface CatalogueLike {
  title: string;
  authors: readonly string[];
  /** Open Library edition count, when known (more editions = the main record). */
  editionCount?: number;
}

/** The main title: the part before a subtitle separator (":", " - ", "("). */
export function mainTitle(title: string): string {
  return normaliseText(title.split(/\s*[:(]\s*|\s+[-–—]\s+/)[0] ?? title);
}

const DERIVATIVE_TITLE = new RegExp(
  [
    'summary',
    'summaries',
    'summarized',
    'resumo',
    'resumen',
    'resume',
    'analysis',
    'key takeaways',
    'takeaways',
    'study guide',
    'guide to',
    'workbook',
    'cliffs ?notes',
    'spark ?notes',
    'notes on',
    'quicklet',
    'trivia',
    'quiz',
    'journal for',
    'habit tracker',
    'lesson plans?',
    'companion to',
    'conversation starters',
    'review of',
    'in \\d+ minutes',
  ]
    .map((w) => `\\b${w}\\b`)
    .join('|')
);

const DERIVATIVE_AUTHOR =
  /\b(summar(y|ies)|instaread|bookhabits|sumoreads|book addict|readtrepreneur|worth books|book tigers|trivia|30 minute|quick ?reads?)\b/;

/**
 * Whether a catalogue record looks like a summary, study guide, workbook or similar companion
 * to another book rather than the book itself.
 */
export function isDerivativeRecord(record: Pick<CatalogueLike, 'title' | 'authors'>): boolean {
  const t = normaliseText(record.title);
  if (DERIVATIVE_TITLE.test(t)) return true;
  const authors = Array.isArray(record.authors) ? record.authors : [];
  if (authors.some((a) => DERIVATIVE_AUTHOR.test(normaliseText(a)))) return true;
  // "Thinking Fast and Slow by Daniel Kahneman" credited to someone else.
  // Needs a two-word name after "by", so "Stand by Me" isn't caught.
  const by = /\bby ([\p{L}\p{N}]+(?: [\p{L}\p{N}]+)+)$/u.exec(t)?.[1];
  if (by) {
    const own = authors.map((a) => normaliseText(a));
    if (!own.some((a) => a && (by.includes(a) || a.includes(by)))) return true;
  }
  return false;
}

/**
 * Whether a record is an exact title (+ author) match for the query: every word of its main
 * title is in the query, and every query word is in the title or an author's name.
 */
export function isExactCatalogueMatch(
  record: Pick<CatalogueLike, 'title' | 'authors'>,
  query: string
): boolean {
  const tokens = tokenize(query);
  if (!tokens.length) return false;
  const main = mainTitle(record.title).split(' ').filter(Boolean);
  if (!main.length) return false;
  const queryWords = new Set(tokens);
  if (!main.every((w) => queryWords.has(w))) return false;
  const words = new Set([
    ...normaliseText(record.title).split(' '),
    ...(Array.isArray(record.authors) ? record.authors : []).flatMap((a) =>
      normaliseText(a).split(' ')
    ),
  ]);
  return tokens.every((t) => words.has(t));
}

/**
 * Re-ranks catalogue search results: exact title + author matches first (most editions first),
 * then everything else in the catalogue's own order, then summaries, study guides and the like.
 */
export function rankCatalogueResults<T extends CatalogueLike>(
  results: readonly T[],
  query: string
): T[] {
  return results
    .map((r, index) => {
      const derivative = isDerivativeRecord(r);
      const tier = derivative ? 2 : isExactCatalogueMatch(r, query) ? 0 : 1;
      return { r, index, tier };
    })
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        (a.tier === 0 ? (b.r.editionCount ?? 0) - (a.r.editionCount ?? 0) : 0) ||
        a.index - b.index
    )
    .map((x) => x.r);
}

/**
 * Catalogue records that look like the book someone is typing in by hand ("Is it one of
 * these?"): same main title, not a summary or guide. Records by a matching author come first.
 */
export function likelyCatalogueMatches<T extends CatalogueLike>(
  results: readonly T[],
  typed: { title: string; authors: readonly string[] },
  limit = 3
): T[] {
  const title = mainTitle(typed.title);
  if (!title) return [];
  const full = normaliseText(typed.title);
  const authorWords = new Set(
    typed.authors.flatMap((a) => tokenize(a)).filter((w) => w.length > 1)
  );
  const authorMatch = (r: T) =>
    authorWords.size > 0 &&
    (Array.isArray(r.authors) ? r.authors : []).some((a) =>
      tokenize(a).some((w) => authorWords.has(w))
    );
  return results
    .map((r, index) => ({ r, index }))
    .filter(
      ({ r }) =>
        !isDerivativeRecord(r) && (mainTitle(r.title) === title || normaliseText(r.title) === full)
    )
    .sort(
      (a, b) =>
        Number(authorMatch(b.r)) - Number(authorMatch(a.r)) ||
        (b.r.editionCount ?? 0) - (a.r.editionCount ?? 0) ||
        a.index - b.index
    )
    .slice(0, limit)
    .map((x) => x.r);
}
