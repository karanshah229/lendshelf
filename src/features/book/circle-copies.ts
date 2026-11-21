/**
 * Copies of a Book "in your circle": my own copies plus contacts' shared copies,
 * ranked so the most useful ones (available to borrow) come first.
 */
import { itemStatus, type Item, type ItemStatus, type WithId } from '@/types/model';

export type CircleItem = WithId<
  Pick<Item, 'ownerId' | 'workId' | 'visibility' | 'loanState' | 'dueDate'>
>;

export interface CircleCopy<T extends CircleItem = CircleItem> {
  item: T;
  isMine: boolean;
  status: ItemStatus;
}

export interface RankOptions {
  uid: string;
  /** Item ids I have an open request for. */
  requestedItemIds?: ReadonlySet<string>;
  /** Item ids I'm borrowing right now (shown as "With you"). */
  borrowedItemIds?: ReadonlySet<string>;
  /** Display name for an owner, used as the last tie-breaker. */
  nameOf?: (ownerId: string) => string;
}

const STATUS_RANK: Record<ItemStatus['kind'], number> = {
  available: 0,
  requested: 1,
  lent: 2,
  notLendable: 3,
  hidden: 4,
};

function dueMillis(status: ItemStatus): number {
  if (status.kind === 'lent' && status.withMe) return -Infinity;
  return status.kind === 'lent' && status.dueDate ? status.dueDate.getTime() : Infinity;
}

/** Compares two copies: available first, then requested by me, then lent (with me first, then back soonest), then not lendable. */
export function compareCircleCopies(
  a: CircleCopy,
  b: CircleCopy,
  nameOf?: (ownerId: string) => string
): number {
  const rank = STATUS_RANK[a.status.kind] - STATUS_RANK[b.status.kind];
  if (rank) return rank;
  const da = dueMillis(a.status);
  const db = dueMillis(b.status);
  if (da !== db) return da < db ? -1 : 1;
  if (nameOf) {
    const byName = nameOf(a.item.ownerId).localeCompare(nameOf(b.item.ownerId));
    if (byName) return byName;
  }
  return a.item.id.localeCompare(b.item.id);
}

/** Splits copies into mine and others (deduplicated by id) and ranks each list. */
export function rankCircleCopies<T extends CircleItem>(
  copies: readonly T[],
  { uid, requestedItemIds, borrowedItemIds, nameOf }: RankOptions
): { mine: CircleCopy<T>[]; others: CircleCopy<T>[] } {
  const seen = new Set<string>();
  const mine: CircleCopy<T>[] = [];
  const others: CircleCopy<T>[] = [];
  for (const item of copies) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const isMine = item.ownerId === uid;
    const status = itemStatus(item, {
      requestedByMe: !isMine && !!requestedItemIds?.has(item.id),
      borrowedByMe: !isMine && !!borrowedItemIds?.has(item.id),
    });
    (isMine ? mine : others).push({ item, isMine, status });
  }
  mine.sort((a, b) => compareCircleCopies(a, b));
  others.sort((a, b) => compareCircleCopies(a, b, nameOf));
  return { mine, others };
}

/** All copies of one Book in my circle (mine + contacts' shared copies). */
export function circleCopiesForWork<T extends CircleItem>(
  workId: string,
  copies: readonly T[],
  options: RankOptions
) {
  return rankCircleCopies(
    copies.filter((c) => c.workId === workId),
    options
  );
}

export interface CopySummary {
  /** Copies other people have. */
  othersCount: number;
  /** Other people's copies I could ask for right now. */
  availableCount: number;
  /** How many copies I own. */
  mineCount: number;
  /** The most useful status among other people's copies (null when only I have it). */
  bestStatus: ItemStatus | null;
  /** Distinct other owners, best copy first. */
  ownerIds: string[];
  /** Distinct other owners with a copy I could ask for now. */
  availableOwnerIds: string[];
}

/** One-line summary of a Book's copies for list rows (Discover, Wishlist). */
export function summarizeCircleCopies(ranked: {
  mine: readonly CircleCopy[];
  others: readonly CircleCopy[];
}): CopySummary {
  const ownerIds: string[] = [];
  const availableOwnerIds: string[] = [];
  for (const c of ranked.others) {
    if (!ownerIds.includes(c.item.ownerId)) ownerIds.push(c.item.ownerId);
    if (c.status.kind === 'available' && !availableOwnerIds.includes(c.item.ownerId)) {
      availableOwnerIds.push(c.item.ownerId);
    }
  }
  return {
    othersCount: ranked.others.length,
    availableCount: ranked.others.filter((c) => c.status.kind === 'available').length,
    mineCount: ranked.mine.length,
    bestStatus: ranked.others[0]?.status ?? null,
    ownerIds,
    availableOwnerIds,
  };
}
