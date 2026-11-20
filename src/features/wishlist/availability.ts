/**
 * One-line "can I get it?" summary for a Book on my wishlist (also used by Discover rows).
 */
import { backLabel } from '@/lib/dates';

import type { CopySummary } from '@/features/book/circle-copies';
import { joinNames } from '@/features/shared/people';

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
