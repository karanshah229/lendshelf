/**
 * Home feed highlights shown when you're not searching (D4 Home, C8): New this week grouped by
 * person, Available to borrow, Popular in your circle.
 */
import { bookKey, groupByBook, normaliseText, type SearchableCopy } from '@/lib/search';
import type { Item, TimestampLike } from '@/types/model';

export interface PopularWork<T> {
  /** The work id to open (the one with most copies when editions are merged). */
  workId: string;
  title: string;
  authors: string[];
  copies: T[];
  /** Distinct people who own a copy. */
  ownerCount: number;
}

/** "Popular in your circle" is hidden when it has fewer entries than this (D4). */
export const POPULAR_MIN_ENTRIES = 3;

/**
 * Books owned by the most people in my circle (at least `minOwners`), most owners first, then
 * most copies, then title. Pass only contacts' copies; books I own (`exclude`, matched by work id
 * or by title + first author) are left out. Copies of one book filed under different catalogue
 * records count together.
 */
export function popularInCircle<T extends SearchableCopy & { ownerId: string }>(
  networkCopies: readonly T[],
  {
    limit = 8,
    minOwners = 2,
    exclude = [],
  }: {
    limit?: number;
    minOwners?: number;
    /** My own copies: their books are never "popular" for me. */
    exclude?: readonly SearchableCopy[];
  } = {}
): PopularWork<T>[] {
  const ownedWorkIds = new Set(exclude.map((c) => c.workId));
  const ownedKeys = new Set(exclude.map((c) => bookKey(c.title, c.authors)));
  return groupByBook(networkCopies)
    .filter(
      (g) =>
        !g.workIds.some((w) => ownedWorkIds.has(w)) && !ownedKeys.has(bookKey(g.title, g.authors))
    )
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

export interface PersonNew<T> {
  ownerId: string;
  /** This person's new copies, newest first. */
  items: T[];
  /** createdAt of the newest one (ms). */
  latest: number;
}

type Dated = { ownerId: string; createdAt?: TimestampLike | null };

const millis = (i: Dated) => i.createdAt?.toMillis?.() ?? 0;

/**
 * "New this week", grouped by person: contacts' copies added in the last `days` days, one entry
 * per owner, the person who added something most recently first.
 */
export function newByPerson<T extends Dated & { id: string }>(
  networkCopies: readonly T[],
  {
    now = new Date(),
    days = 7,
    maxPeople = 6,
  }: { now?: Date; days?: number; maxPeople?: number } = {}
): PersonNew<T>[] {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const byOwner = new Map<string, T[]>();
  for (const item of networkCopies) {
    if (millis(item) < since) continue;
    const list = byOwner.get(item.ownerId);
    if (list) list.push(item);
    else byOwner.set(item.ownerId, [item]);
  }
  return [...byOwner.entries()]
    .map(([ownerId, items]) => {
      const sorted = [...items].sort((a, b) => millis(b) - millis(a));
      return { ownerId, items: sorted, latest: millis(sorted[0]!) };
    })
    .sort((a, b) => b.latest - a.latest || a.ownerId.localeCompare(b.ownerId))
    .slice(0, maxPeople);
}

/**
 * "Available to borrow": contacts' copies I could ask for right now, excluding books already
 * shown in New this week (any copy of the same book, across catalogue records), what I've asked
 * for and what I'm borrowing.
 */
export function availableToBorrow<
  T extends Pick<Item, 'visibility' | 'loanState'> & SearchableCopy & { id: string },
>(
  networkCopies: readonly T[],
  {
    exclude = [],
    requestedItemIds = new Set<string>(),
    borrowedItemIds = new Set<string>(),
    limit = 9,
  }: {
    /** Copies already shown elsewhere on the feed (New this week). */
    exclude?: readonly (SearchableCopy & { id: string })[];
    requestedItemIds?: ReadonlySet<string>;
    borrowedItemIds?: ReadonlySet<string>;
    limit?: number;
  } = {}
): T[] {
  const ids = new Set(exclude.map((c) => c.id));
  const workIds = new Set(exclude.map((c) => c.workId));
  const keys = new Set(exclude.map((c) => bookKey(c.title, c.authors)));
  return networkCopies
    .filter(
      (i) =>
        i.loanState === 'available' &&
        i.visibility === 'lendable' &&
        !ids.has(i.id) &&
        !workIds.has(i.workId) &&
        !keys.has(bookKey(i.title, i.authors)) &&
        !requestedItemIds.has(i.id) &&
        !borrowedItemIds.has(i.id)
    )
    .slice(0, limit);
}
