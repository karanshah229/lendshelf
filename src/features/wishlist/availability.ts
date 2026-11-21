/**
 * One-line "can I get it?" summary for a Book on my wishlist (also used by Discover rows).
 */
import { backLabel } from '@/lib/dates';

import {
  circleCopiesForBook,
  summarizeCircleCopies,
  type CircleCopy,
  type CircleItem,
  type CopySummary,
  type RankOptions,
} from '@/features/book/circle-copies';
import { joinNames } from '@/features/shared/people';

export interface WishlistMatch<T extends CircleItem> {
  workId: string;
  title: string;
  /** The best copy to ask for (available, from someone in my circle). */
  best: CircleCopy<T>;
  summary: CopySummary;
}

/**
 * Home › "From your wishlist": wishlist books that someone in my circle has available right now
 * (including copies filed under another catalogue record of the same book). Books I own a copy
 * of are left out. Keeps the wishlist's order.
 */
export function wishlistAvailableNow<T extends CircleItem & { title: string; authors: string[] }>(
  wishlist: readonly { workId: string; title: string }[],
  copies: readonly T[],
  options: RankOptions
): WishlistMatch<T>[] {
  const out: WishlistMatch<T>[] = [];
  for (const w of wishlist) {
    const ranked = circleCopiesForBook(w.workId, null, copies, options);
    const summary = summarizeCircleCopies(ranked);
    const best = ranked.others[0];
    if (!best || best.status.kind !== 'available' || summary.mineCount > 0) continue;
    out.push({ workId: w.workId, title: w.title, best, summary });
  }
  return out;
}

export type AvailabilityTone = 'available' | 'lent' | 'mine' | 'none';

export interface Availability {
  tone: AvailabilityTone;
  text: string;
  /** Sort key: lower is more useful. */
  rank: number;
}

export function wishlistAvailability(
  summary: CopySummary,
  nameOf: (uid: string) => string,
  now: Date = new Date()
): Availability {
  const names = summary.ownerIds.map(nameOf);
  if (summary.availableOwnerIds.length > 0) {
    return {
      tone: 'available',
      text: `Available from ${joinNames(summary.availableOwnerIds.map(nameOf))}`,
      rank: 0,
    };
  }
  if (summary.othersCount > 0) {
    const best = summary.bestStatus;
    // Ranking puts the copy I'm borrowing first among lent copies.
    if (best?.kind === 'lent' && best.withMe) {
      return {
        tone: 'lent',
        text: `With you · borrowed from ${nameOf(summary.ownerIds[0] ?? '')}`,
        rank: 1,
      };
    }
    const detail =
      best?.kind === 'lent'
        ? backLabel(best.dueDate, now) === 'lent out'
          ? 'lent out'
          : `lent out, ${backLabel(best.dueDate, now)}`
        : best?.kind === 'requested'
          ? 'you’ve asked for it'
          : 'not lending it';
    const verb = names.length === 1 ? 'has' : 'have';
    return { tone: 'lent', text: `${joinNames(names)} ${verb} it · ${detail}`, rank: 1 };
  }
  if (summary.mineCount > 0) {
    return { tone: 'mine', text: 'You own a copy now', rank: 2 };
  }
  return { tone: 'none', text: 'No one in your circle has it yet', rank: 3 };
}
