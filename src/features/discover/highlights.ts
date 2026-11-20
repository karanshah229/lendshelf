/**
 * Discover-tab highlights shown when you're not searching.
 */
import { groupByWork, normaliseText, type SearchableCopy } from '@/lib/search';

export interface PopularWork<T> {
  workId: string;
  title: string;
  authors: string[];
  copies: T[];
  /** Distinct people who own a copy. */
  ownerCount: number;
}

/**
 * Books owned by the most people in your circle (at least `minOwners`), most owners first,
 * then most copies, then title.
 */
export function popularInCircle<T extends SearchableCopy & { ownerId: string }>(
  copies: readonly T[],
  { limit = 8, minOwners = 2 }: { limit?: number; minOwners?: number } = {}
): PopularWork<T>[] {
  return groupByWork(copies)
    .map((g) => ({
      workId: g.workId,
      title: g.title,
      authors: g.authors,
      copies: g.copies,
      ownerCount: new Set(g.copies.map((c) => c.ownerId)).size,
    }))
    .filter((g) => g.ownerCount >= minOwners)
    .sort(
      (a, b) =>
        b.ownerCount - a.ownerCount ||
        b.copies.length - a.copies.length ||
        normaliseText(a.title).localeCompare(normaliseText(b.title))
    )
    .slice(0, limit);
}

/** Shared-copy count per owner (for the "Your circle" row). */
export function countByOwner(copies: readonly { ownerId: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of copies) counts.set(c.ownerId, (counts.get(c.ownerId) ?? 0) + 1);
  return counts;
}
