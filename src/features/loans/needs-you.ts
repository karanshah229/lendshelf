/**
 * "Needs you": the loans where I have to act, as cards (UX §D4, §F5). Pure, so the order,
 * the pick-up window and the badge count can be tested without Firebase.
 *
 * What becomes a card (F5):
 *   - incoming requests, grouped per copy ("2 people want Animal Farm" is one card)
 *   - "says returned" (the borrower marked it returned; I confirm)
 *   - my lent books that are overdue
 *   - my borrowed books due within 2 days or overdue
 *   - the borrower's pick-up window (48 h after an accepted request)
 *   - my own requests that expire within 2 days
 *   - the owner said "Not back yet" on a book I said I returned (QA B1), for NOT_BACK_YET_DAYS
 *   - "another request accepted" (R14): one of my requests was accepted while another of my
 *     requests for the same Book is still open ("Cancel your request to Kabir?"), until I
 *     cancel it or choose "Keep both" (`dismissed`)
 *
 * Order: oldest deadline first (D4). A deadline that has already passed (overdue, says
 * returned) sorts before one still to come. Ties go by card kind, then id.
 * The Loans tab badge is `needsYou(...).length` (cards, not loans: R23).
 */
import { addDays, calendarDaysBetween, dueState } from '@/lib/dates';
import { REQUEST_EXPIRY_DAYS, type Loan, type WithId } from '@/types/model';

import { otherOpenRequestsAfterAccept } from '@/features/loans/requests';

type L = WithId<Loan>;

/** How long after an accept the pick-up wording applies (E4). */
export const PICKUP_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Borrowed books and my own requests become cards this many days before their deadline. */
export const SOON_DAYS = 2;
/** How long the borrower's "Ravi hasn't got it back yet" card stays (the Loan and row keep saying it). */
export const NOT_BACK_YET_DAYS = 3;

/**
 * Whether a loan is in its pick-up window: it came from a request (`requestedAt` set; loans
 * recorded by hand never get one), it's active, and it was accepted less than 48 h ago.
 * Time-based, so both devices switch wording at the same moment, except that it ends early once
 * anyone has talked about a return ("I've returned it" / "Not back yet"): the book was clearly
 * collected (QA Pixel B).
 */
export function inPickupWindow(
  loan: Pick<Loan, 'status' | 'requestedAt' | 'startedAt'> &
    Partial<Pick<Loan, 'returnMarkedAt' | 'notBackYetAt' | 'returnEvents'>>,
  now: Date = new Date()
): boolean {
  if (loan.status !== 'active' || !loan.requestedAt || !loan.startedAt) return false;
  if (loan.returnMarkedAt || loan.notBackYetAt || (loan.returnEvents?.length ?? 0) > 0)
    return false;
  const since = now.getTime() - loan.startedAt.toMillis();
  // A startedAt slightly in the future is clock skew between this device and the server.
  return since < PICKUP_WINDOW_MS;
}

/** When the pick-up window ends (null when the loan never has one). */
export function pickupWindowEnds(loan: Pick<Loan, 'requestedAt' | 'startedAt'>): Date | null {
  if (!loan.requestedAt || !loan.startedAt) return null;
  return new Date(loan.startedAt.toMillis() + PICKUP_WINDOW_MS);
}

/** When a request expires (requestedAt + 7 days). */
export function requestExpiresAt(loan: Pick<Loan, 'requestedAt'>): Date | null {
  return loan.requestedAt ? addDays(loan.requestedAt, REQUEST_EXPIRY_DAYS) : null;
}

export type NeedsYouCard =
  /** Requests for one of my copies, oldest first. One card per copy. */
  | { kind: 'requests'; key: string; itemId: string; loans: L[]; deadline: number }
  /** The borrower says they returned my copy. */
  | { kind: 'saysReturned'; key: string; loan: L; deadline: number }
  /** My copy is overdue with someone. */
  | { kind: 'overdueLent'; key: string; loan: L; daysOverdue: number; deadline: number }
  /** A book I've borrowed is due within 2 days, today, or overdue. */
  | { kind: 'dueBorrowed'; key: string; loan: L; deadline: number }
  /** I'm the borrower and the owner just said yes: arrange the pick-up. */
  | { kind: 'pickup'; key: string; loan: L; deadline: number }
  /** I'm the borrower and the owner said "Not back yet": talk to them. */
  | { kind: 'notBackYet'; key: string; loan: L; deadline: number }
  /** My own request expires within 2 days. */
  | { kind: 'requestExpiring'; key: string; loan: L; deadline: number }
  /** R14: `accepted` was accepted while my request `loan` for the same Book is still open. */
  | { kind: 'otherAccepted'; key: string; loan: L; accepted: L; deadline: number };

/** Key of the R14 card for one of my open requests (also what "Keep both" dismisses). */
export const otherAcceptedKey = (requestId: string) => `other:${requestId}`;

export type NeedsYouKind = NeedsYouCard['kind'];

/** Tie-break when two deadlines are equal: things the other person is waiting on first. */
const KIND_ORDER: Record<NeedsYouKind, number> = {
  saysReturned: 0,
  requests: 1,
  overdueLent: 2,
  notBackYet: 3,
  dueBorrowed: 4,
  pickup: 5,
  otherAccepted: 6,
  requestExpiring: 7,
};

const ms = (t: { toMillis(): number } | null | undefined, fallback: number) =>
  t ? t.toMillis() : fallback;

/** Builds the Needs-you cards for `uid` (duplicates across the two lists are ignored). */
export function needsYou(
  uid: string,
  asOwner: readonly L[],
  asBorrower: readonly L[],
  now: Date = new Date(),
  opts: { dismissed?: ReadonlySet<string> } = {}
): NeedsYouCard[] {
  const nowMs = now.getTime();
  const seen = new Set<string>();
  const cards: NeedsYouCard[] = [];
  const requestsByItem = new Map<string, L[]>();

  // R14 first: a request with an R14 card doesn't also get a "request expiring" card.
  const otherAccepted = new Set<string>();
  for (const { request, accepted } of otherOpenRequestsAfterAccept(uid, asBorrower)) {
    otherAccepted.add(request.id);
    const key = otherAcceptedKey(request.id);
    if (opts.dismissed?.has(key)) continue;
    cards.push({
      kind: 'otherAccepted',
      key,
      loan: request,
      accepted,
      deadline: requestExpiresAt(request)?.getTime() ?? ms(request.updatedAt, nowMs),
    });
  }

  for (const l of [...asOwner, ...asBorrower]) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);

    if (l.ownerId === uid) {
      if (l.status === 'requested') {
        // Past 7 days it can't be accepted any more; the daily job will mark it expired (QA B14).
        if ((requestExpiresAt(l)?.getTime() ?? Infinity) <= nowMs) continue;
        const list = requestsByItem.get(l.itemId) ?? [];
        list.push(l);
        requestsByItem.set(l.itemId, list);
      } else if (l.status === 'returnPending') {
        cards.push({
          kind: 'saysReturned',
          key: `returned:${l.id}`,
          loan: l,
          deadline: ms(l.returnMarkedAt, ms(l.updatedAt, nowMs)),
        });
      } else if (l.status === 'active' && l.dueDate && !inPickupWindow(l, now)) {
        const state = dueState(l.dueDate, now);
        if (state.kind === 'overdue') {
          cards.push({
            kind: 'overdueLent',
            key: `overdue:${l.id}`,
            loan: l,
            daysOverdue: state.days,
            deadline: l.dueDate.toMillis(),
          });
        }
      }
      continue;
    }

    if (l.borrowerUid !== uid) continue;
    if (l.status === 'active') {
      const notBack = l.notBackYetAt?.toMillis();
      if (notBack && nowMs - notBack < NOT_BACK_YET_DAYS * 24 * 60 * 60 * 1000) {
        // Already past: sorts with the things waiting on me.
        cards.push({ kind: 'notBackYet', key: `notBack:${l.id}`, loan: l, deadline: notBack });
      } else if (inPickupWindow(l, now)) {
        cards.push({
          kind: 'pickup',
          key: `pickup:${l.id}`,
          loan: l,
          deadline: pickupWindowEnds(l)!.getTime(),
        });
      } else if (l.dueDate && calendarDaysBetween(now, l.dueDate) <= SOON_DAYS) {
        cards.push({
          kind: 'dueBorrowed',
          key: `due:${l.id}`,
          loan: l,
          deadline: l.dueDate.toMillis(),
        });
      }
    } else if (l.status === 'requested' && !otherAccepted.has(l.id)) {
      const expires = requestExpiresAt(l);
      if (expires && calendarDaysBetween(now, expires) <= SOON_DAYS) {
        cards.push({
          kind: 'requestExpiring',
          key: `expiring:${l.id}`,
          loan: l,
          deadline: expires.getTime(),
        });
      }
    }
  }

  for (const [itemId, loans] of requestsByItem) {
    loans.sort((a, b) => ms(a.requestedAt, 0) - ms(b.requestedAt, 0));
    const first = loans[0]!;
    cards.push({
      kind: 'requests',
      key: `requests:${itemId}`,
      itemId,
      loans,
      deadline: requestExpiresAt(first)?.getTime() ?? ms(first.updatedAt, nowMs),
    });
  }

  return cards.sort(
    (a, b) =>
      a.deadline - b.deadline ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.key.localeCompare(b.key)
  );
}

/** The Loans tab badge: the number of Needs-you cards (F5, R23). */
export function needsYouBadge(cards: readonly NeedsYouCard[]): number | undefined {
  return cards.length || undefined;
}

/** All loans behind a card (a grouped request card has several). */
export function cardLoans(card: NeedsYouCard): L[] {
  if (card.kind === 'requests') return card.loans;
  if (card.kind === 'otherAccepted') return [card.loan, card.accepted];
  return [card.loan];
}
