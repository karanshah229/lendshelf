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

/** Lowercase, strip diacritics and punctuation, collapse whitespace. "Gabriel García-Márquez" → "gabriel garcia marquez". */
export function normaliseText(value: string): string {
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
export function scoreWork(title: string, authors: string[], query: string): number {
  const tokens = tokenize(query);
  if (!tokens.length) return 0;
  const t = normaliseText(title);
  const tWords = t.split(' ');
  const a = normaliseText(authors.join(' '));
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
  if (a === q || authors.some((au) => normaliseText(au) === q)) score += 40;
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
