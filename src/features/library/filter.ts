/**
 * My books: collection switcher, quick filter and local search over my own copies,
 * plus the owner's view of a copy's status.
 */
import { backLabel, isOverdue } from '@/lib/dates';
import { scoreWork, tokenize } from '@/lib/search';
import type { Item, TimestampLike } from '@/types/model';

export type QuickFilter = 'all' | 'lent' | 'hidden';
/** 'all' or a shelf id. */
export type ShelfFilter = string;
export const ALL_SHELVES = 'all';

type CopyLike = Pick<
  Item,
  'shelfId' | 'visibility' | 'loanState' | 'title' | 'authors' | 'workId'
> & { dueDate: TimestampLike | Date | null };

export function matchesQuickFilter(item: CopyLike, filter: QuickFilter): boolean {
  if (filter === 'lent') return item.loanState === 'lent';
  if (filter === 'hidden') return item.visibility === 'hidden';
  return true;
}

/**
 * Applies the collection, quick filter and search. Without a query the input order is kept
 * (newest first); with one, best matches come first.
 */
export function filterCopies<T extends CopyLike>(
  items: readonly T[],
  opts: { shelfId: ShelfFilter; filter: QuickFilter; query: string }
): T[] {
  const scoped = items.filter(
    (i) =>
      (opts.shelfId === ALL_SHELVES || i.shelfId === opts.shelfId) &&
      matchesQuickFilter(i, opts.filter)
  );
  if (!tokenize(opts.query).length) return scoped;
  return scoped
    .map((item, index) => ({ item, index, score: scoreWork(item.title, item.authors, opts.query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}

export interface LibraryCounts {
  all: number;
  lent: number;
  hidden: number;
  byShelf: Record<string, number>;
}

/** Counts for the switcher chips (per shelf) and the quick filters (within the current shelf). */
export function countCopies(items: readonly CopyLike[], shelfId: ShelfFilter): LibraryCounts {
  const counts: LibraryCounts = { all: 0, lent: 0, hidden: 0, byShelf: {} };
  for (const i of items) {
    counts.byShelf[i.shelfId] = (counts.byShelf[i.shelfId] ?? 0) + 1;
    if (shelfId !== ALL_SHELVES && i.shelfId !== shelfId) continue;
    counts.all += 1;
    if (i.loanState === 'lent') counts.lent += 1;
    if (i.visibility === 'hidden') counts.hidden += 1;
  }
  return counts;
}

export type OwnerStatusTone = 'success' | 'muted' | 'lent' | 'overdue';

export interface OwnerStatus {
  kind: 'available' | 'lent' | 'hidden' | 'visibleOnly' | 'private';
  /** Full label, e.g. "Lent · back 12 Dec". */
  label: string;
  /** Short label for small grid cards, e.g. "Back 12 Dec". */
  short: string;
  tone: OwnerStatusTone;
}

const toDateInput = (d: TimestampLike | Date) => (d instanceof Date ? d : d.toDate());

/**
 * How a copy looks to its owner. Lent wins over everything; then whether contacts can see it
 * (hidden copy, private collection), then whether they can ask to borrow it.
 */
export function ownerStatus(
  item: Pick<CopyLike, 'visibility' | 'loanState' | 'dueDate'>,
  shelfIsPublic: boolean,
  now: Date = new Date()
): OwnerStatus {
  if (item.loanState === 'lent') {
    const due = item.dueDate ? toDateInput(item.dueDate) : null;
    const back = backLabel(due, now);
    const overdue = isOverdue(due, now);
    return {
      kind: 'lent',
      label: due ? `Lent · ${back}` : 'Lent out',
      short: due ? back.charAt(0).toUpperCase() + back.slice(1) : 'Lent out',
      tone: overdue ? 'overdue' : 'lent',
    };
  }
  if (item.visibility === 'hidden') {
    return { kind: 'hidden', label: 'Hidden', short: 'Hidden', tone: 'muted' };
  }
  if (!shelfIsPublic) {
    return { kind: 'private', label: 'Private collection', short: 'Private', tone: 'muted' };
  }
  if (item.visibility === 'visible') {
    return { kind: 'visibleOnly', label: 'Visible only', short: 'Visible only', tone: 'muted' };
  }
  return { kind: 'available', label: 'Available', short: 'Available', tone: 'success' };
}
