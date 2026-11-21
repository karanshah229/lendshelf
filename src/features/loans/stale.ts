/**
 * Acting on a loan that changed under an open sheet (QA B3, E4/E5 failure exits): the request
 * was cancelled, expired, already answered, or the loan moved on. Pure: given the loan as it is
 * now on the server, say what happened in words, and whether to offer "Message Asha".
 *
 *   const out = staleOutcome('decline', fresh, { role: 'owner', other: 'Kabir Shah' });
 *   // { text: 'Kabir cancelled this request', message: false }
 */
import type { Loan } from '@/types/model';

import { requestExpiresAt } from '@/features/loans/needs-you';
import { shortName } from '@/features/shared/people';

/** What the user tried: a confirm sheet kind, the accept (due-date) sheet, or a due change. */
export type StaleAction =
  | 'accept'
  | 'decline'
  | 'cancelRequest'
  | 'gotItBack'
  | 'notBackYet'
  | 'notCollected'
  | 'markReturned'
  | 'changeDue';

export interface StaleOutcome {
  /** One short line for a toast: "Kabir cancelled this request". */
  text: string;
  /** Offer "Message Kabir" next to it (E4/E5: "This request expired. Message Zoya?"). */
  message: boolean;
}

/** The statuses each action can start from (mirrors the server's transitions). */
const FROM: Record<StaleAction, readonly Loan['status'][]> = {
  accept: ['requested'],
  decline: ['requested'],
  cancelRequest: ['requested'],
  gotItBack: ['active', 'returnPending'],
  notBackYet: ['returnPending'],
  notCollected: ['active'],
  markReturned: ['active'],
  changeDue: ['active', 'returnPending'],
};

/** Whether a request has passed its 7 days (the server expires it on the next run). */
export function requestTimedOut(
  loan: Pick<Loan, 'status' | 'requestedAt'>,
  now: Date = new Date()
): boolean {
  if (loan.status !== 'requested') return false;
  const ends = requestExpiresAt(loan);
  return !!ends && ends.getTime() <= now.getTime();
}

/**
 * What happened to a loan the user just tried to act on, or null when the action still fits
 * (then the error was something else: show it as usual). `fresh` is the loan as read now;
 * undefined when it no longer exists or can't be read.
 */
export function staleOutcome(
  action: StaleAction,
  fresh: Pick<Loan, 'status' | 'requestedAt' | 'declineReason' | 'closedReason'> | undefined,
  ctx: { role: 'owner' | 'borrower'; other: string; now?: Date }
): StaleOutcome | null {
  const name = shortName(ctx.other) || 'They';
  const owner = ctx.role === 'owner';
  if (!fresh) {
    return {
      text: owner ? 'This request was withdrawn' : 'This isn’t there any more',
      message: false,
    };
  }
  if (FROM[action].includes(fresh.status)) {
    return requestTimedOut(fresh, ctx.now)
      ? { text: owner ? 'This request expired' : 'Your request expired', message: owner }
      : null;
  }
  switch (fresh.status) {
    case 'cancelled':
      if (fresh.closedReason === 'notCollected') {
        return { text: 'This loan was closed as not collected', message: false };
      }
      if (fresh.closedReason === 'copyRemoved') {
        return { text: 'This copy was removed', message: false };
      }
      return {
        text: owner ? `${name} cancelled this request` : 'You cancelled this request',
        message: false,
      };
    case 'expired':
      return { text: owner ? 'This request expired' : 'Your request expired', message: owner };
    case 'declined':
      if (owner) {
        return {
          text:
            fresh.declineReason === 'lentToSomeoneElse'
              ? `This copy went to someone else, so ${name}’s request was declined`
              : `You already declined ${name}’s request`,
          message: false,
        };
      }
      return { text: `${name} declined this request`, message: false };
    case 'active':
      return owner
        ? {
            text:
              action === 'decline' || action === 'accept'
                ? `You already lent it to ${name}`
                : action === 'notBackYet'
                  ? 'You already said it’s not back yet'
                  : 'This loan is open',
            message: false,
          }
        : {
            text: action === 'cancelRequest' ? `${name} already said yes` : 'This loan is open',
            message: false,
          };
    case 'returnPending':
      return owner
        ? { text: `${name} says it’s back`, message: false }
        : { text: 'You already said you returned it', message: false };
    case 'returned':
      return { text: 'This book is already back', message: false };
    case 'ownerLeft':
      return {
        text: owner ? 'This loan is closed' : `${name} left LendShelf`,
        message: false,
      };
    case 'requested':
      return null;
  }
}

/** Server codes that mean "the loan isn't in the state you saw", not a network problem. */
export const STALE_CODES: readonly string[] = [
  'failed-precondition',
  'not-found',
  'permission-denied',
  'already-exists',
];
