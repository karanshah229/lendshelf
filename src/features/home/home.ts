/**
 * Home's top section, pure (UX §D4 Home, §E2a, R13): the Needs-you slice and "See all n in
 * Loans", the one-line status strip and the setup card's state.
 */
import { backLabel, dueLabel, isOverdue } from '@/lib/dates';
import type { Loan } from '@/types/model';

/** Home shows at most this many Needs-you cards (R13); the rest are behind "See all". */
export const HOME_MAX_CARDS = 2;

/**
 * The cards Home shows and the "See all n in Loans" count (null when every card is shown).
 * `n` is the total, so "See all 4 in Loans" with 2 shown.
 */
export function homeNeedsYou<T>(
  cards: readonly T[],
  max: number = HOME_MAX_CARDS
): { shown: T[]; total: number; seeAll: number | null } {
  return {
    shown: cards.slice(0, max),
    total: cards.length,
    seeAll: cards.length > max ? cards.length : null,
  };
}

/** "See all 4 in Loans". */
export const seeAllLabel = (n: number) => `See all ${n} in Loans`;

type StripLoan = Pick<Loan, 'status' | 'dueDate'>;

/** Due dates of the active loans (returned-but-unconfirmed ones have nothing due), soonest first. */
const dueDates = (loans: readonly StripLoan[]) =>
  loans
    .filter((l) => l.status === 'active' && l.dueDate)
    .map((l) => l.dueDate!)
    .sort((a, b) => a.toMillis() - b.toMillis());

/**
 * The date part for one side: one loan reads its own date ("due 12 Dec", "overdue 3 days");
 * several read "next due 7 Dec", or "1 overdue" when any are late (in words, F8).
 */
function datePart(
  loans: readonly StripLoan[],
  label: (d: NonNullable<Loan['dueDate']>, now: Date) => string,
  now: Date
): string {
  const dates = dueDates(loans);
  if (!dates.length) return '';
  const late = dates.filter((d) => isOverdue(d, now)).length;
  if (loans.length === 1) return `, ${label(dates[0]!, now)}`;
  if (late) return `, ${late} overdue`;
  return `, next ${label(dates[0]!, now)}`;
}

/**
 * The status strip (D4): "2 out with friends · 1 with you, due 12 Dec". The date is for the
 * books I have to give back; with nothing borrowed, for my copies due back to me ("next back
 * 12 Dec"). Overdue reads in words. Null with no open loans.
 */
export function statusStripText(
  outWithFriends: readonly StripLoan[],
  withYou: readonly StripLoan[],
  now: Date = new Date()
): string | null {
  const parts: string[] = [];
  if (outWithFriends.length) {
    const back = withYou.length ? '' : datePart(outWithFriends, backLabel, now);
    parts.push(`${outWithFriends.length} out with friends${back}`);
  }
  if (withYou.length) parts.push(`${withYou.length} with you${datePart(withYou, dueLabel, now)}`);
  return parts.length ? parts.join(' · ') : null;
}

export type SetupStep = 'people' | 'books' | 'pickup';

export interface SetupCardState {
  /** 0–3 steps done, for "Get set up · 1 of 3". */
  done: number;
  steps: { step: SetupStep; done: boolean }[];
  /** The card's single primary: the first unfinished step. */
  primary: SetupStep;
  /** The × appears once two steps are done (E2a). */
  canDismiss: boolean;
}

/**
 * The setup card (E2a): Find your people · Add your books · Set your pickup spot. Null when
 * it's hidden: all three done, dismissed (only possible once two are done), or while Needs you
 * has cards (R13).
 */
export function setupCardState(input: {
  hasPeople: boolean;
  hasBooks: boolean;
  hasPickup: boolean;
  dismissed: boolean;
  needsYouCount: number;
}): SetupCardState | null {
  const steps: { step: SetupStep; done: boolean }[] = [
    { step: 'people', done: input.hasPeople },
    { step: 'books', done: input.hasBooks },
    { step: 'pickup', done: input.hasPickup },
  ];
  const done = steps.filter((s) => s.done).length;
  const canDismiss = done >= 2;
  const next = steps.find((s) => !s.done);
  if (!next || input.needsYouCount > 0 || (canDismiss && input.dismissed)) return null;
  return { done, steps, primary: next.step, canDismiss };
}
