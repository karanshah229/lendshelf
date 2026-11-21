/**
 * Pure loan bucketing for the Loans tab (UX §D4 "Loans (the ledger)"): one scroll with
 * Needs you (see `needs-you.ts`) · Out with friends · With you · Your requests · Recent · History.
 */
import { addDays, calendarDaysBetween, dueLabel, dueState, timeAgo } from '@/lib/dates';
import { REQUEST_EXPIRY_DAYS, type Loan, type LoanStatus, type WithId } from '@/types/model';

import { inPickupWindow } from '@/features/loans/needs-you';
import { declinedLine } from '@/features/loans/requests';
import { shortName } from '@/features/shared/people';

type L = WithId<Loan>;

/** Recent: closed in the last 14 days, at most 10 rows. */
export const RECENT_DAYS = 14;
export const RECENT_MAX = 10;

export type HistoryFilter = 'all' | 'lent' | 'borrowed' | 'requests';

export interface LoanLedger {
  /** Requests on my copies, oldest first. Shown only as Needs-you cards. */
  incoming: L[];
  /** My copies that are with someone (active or says returned), by due date. */
  outWithFriends: L[];
  /** Books I have: by due date, "waiting for confirmation" last. */
  withYou: L[];
  /** My pending requests on other people's copies, newest first. */
  yourRequests: L[];
  /** Closed in the last 14 days (max 10), newest first. */
  recent: L[];
  /** Every closed loan, newest first. */
  history: L[];
}

const millis = (t: { toMillis(): number } | null | undefined, fallback = 0) =>
  t ? t.toMillis() : fallback;

const requestedMs = (l: Loan) => millis(l.requestedAt, millis(l.updatedAt));
/** When a loan was closed: returnedAt for returns, otherwise its last update. */
export const closedMs = (l: Loan) =>
  millis(l.returnedAt) || millis(l.updatedAt) || millis(l.requestedAt);
/** Loans without a due date sort after dated ones. */
const dueMs = (l: Loan) => millis(l.dueDate, Number.MAX_SAFE_INTEGER);

const OPEN: readonly LoanStatus[] = ['requested', 'active', 'returnPending'];

/** Whether a loan was closed because the borrower never picked it up. */
export function isNotCollected(l: Pick<Loan, 'status' | 'closedReason'>): boolean {
  return l.status === 'cancelled' && l.closedReason === 'notCollected';
}

/** Buckets my loans. `asOwner`/`asBorrower` come from `useMyLoans()`; duplicates are ignored. */
export function bucketLoans(
  uid: string,
  asOwner: readonly L[],
  asBorrower: readonly L[],
  now: Date = new Date()
): LoanLedger {
  const seen = new Set<string>();
  const all: L[] = [];
  for (const l of [...asOwner, ...asBorrower]) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    if (l.ownerId === uid || l.borrowerUid === uid) all.push(l);
  }
  const mineAsOwner = all.filter((l) => l.ownerId === uid);
  const mineAsBorrower = all.filter((l) => l.borrowerUid === uid && l.ownerId !== uid);

  const incoming = mineAsOwner
    .filter((l) => l.status === 'requested')
    .sort((a, b) => requestedMs(a) - requestedMs(b));
  const yourRequests = mineAsBorrower
    .filter((l) => l.status === 'requested')
    .sort((a, b) => requestedMs(b) - requestedMs(a));
  const outWithFriends = mineAsOwner
    .filter((l) => l.status === 'active' || l.status === 'returnPending')
    .sort((a, b) => dueMs(a) - dueMs(b));
  const withYou = mineAsBorrower
    .filter((l) => l.status === 'active' || l.status === 'returnPending')
    .sort((a, b) => {
      const pa = a.status === 'returnPending' ? 1 : 0;
      const pb = b.status === 'returnPending' ? 1 : 0;
      return pa - pb || dueMs(a) - dueMs(b);
    });

  const history = all
    .filter((l) => !OPEN.includes(l.status))
    .sort((a, b) => closedMs(b) - closedMs(a));
  const since = addDays(now, -RECENT_DAYS).getTime();
  const recent = history.filter((l) => closedMs(l) >= since).slice(0, RECENT_MAX);

  return { incoming, outWithFriends, withYou, yourRequests, recent, history };
}

/** Which History filter a closed loan belongs to. */
export function historyKind(l: Loan, uid: string): Exclude<HistoryFilter, 'all'> {
  if (l.status === 'declined' || l.status === 'expired') return 'requests';
  if (l.status === 'cancelled' && !isNotCollected(l)) return 'requests';
  return l.ownerId === uid ? 'lent' : 'borrowed';
}

export function filterHistory(history: readonly L[], filter: HistoryFilter, uid: string): L[] {
  return filter === 'all' ? [...history] : history.filter((l) => historyKind(l, uid) === filter);
}

/** Whole days until a pending request expires (0 = expires today), or null without a date. */
export function requestDaysLeft(
  loan: Pick<Loan, 'requestedAt'>,
  now: Date = new Date()
): number | null {
  if (!loan.requestedAt) return null;
  const expires = addDays(loan.requestedAt, REQUEST_EXPIRY_DAYS);
  return Math.max(0, calendarDaysBetween(now, expires));
}

/** "expires today", "expires tomorrow", "expires in 5 days" (null without a date). */
export function expiryLabel(
  loan: Pick<Loan, 'requestedAt'>,
  now: Date = new Date()
): string | null {
  const left = requestDaysLeft(loan, now);
  if (left === null) return null;
  // Past its 7 days but not yet expired by the daily job (QA B14): never "expires today".
  if (loan.requestedAt && addDays(loan.requestedAt, REQUEST_EXPIRY_DAYS).getTime() <= now.getTime()) {
    return 'expired';
  }
  if (left === 0) return 'expires today';
  if (left === 1) return 'expires tomorrow';
  return `expires in ${left} days`;
}

/**
 * Whether tapping the loan can open the copy page: always for my own copies and for a copy I
 * have right now (the page falls back to the loan's details if rules hide the copy); for other
 * borrowed copies only while I still have the owner saved.
 */
export function canOpenCopy(
  loan: Pick<Loan, 'ownerId' | 'itemId'> & Partial<Pick<Loan, 'borrowerUid' | 'status'>>,
  uid: string,
  linkedOwnerIds: ReadonlySet<string>
): boolean {
  if (!loan.itemId) return false;
  // A book I have right now: the copy page falls back to the loan if the copy isn't readable.
  const borrowingNow =
    loan.borrowerUid === uid && (loan.status === 'active' || loan.status === 'returnPending');
  return loan.ownerId === uid || linkedOwnerIds.has(loan.ownerId) || borrowingNow;
}

/** Short status label by status alone, e.g. "Returned", "Declined", "Expired". */
export function closedStatusLabel(status: LoanStatus): string {
  switch (status) {
    case 'returned':
      return 'Returned';
    case 'declined':
      return 'Declined';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    case 'requested':
      return 'Requested';
    case 'active':
      return 'Lent';
    case 'returnPending':
      return 'Return pending';
    case 'ownerLeft':
      return 'Owner left';
  }
}

/** Status badge text for a closed loan, using the server's reasons (F6). */
export function loanStatusLabel(
  l: Pick<Loan, 'status' | 'closedReason' | 'declineReason'>
): string {
  if (isNotCollected(l)) return 'Not collected';
  if (l.status === 'declined' && l.declineReason === 'lentToSomeoneElse') {
    return 'Lent to someone else';
  }
  return closedStatusLabel(l.status);
}

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const first = shortName;

/**
 * Line for an open loan in Out with friends / With you (D4, F6): "with Zoya · due 7 Dec",
 * "Waiting for Asha to pick up", "Pick up from Ravi", "3 days overdue" (in words, never colour
 * alone), "Zoya says it's back", "Waiting for Ravi to confirm". `overdue` drives the red style.
 */
export function openRowLine(
  l: Loan,
  uid: string,
  other: string,
  now: Date = new Date()
): { text: string; overdue: boolean } {
  const owner = l.ownerId === uid;
  const name = first(other);
  if (l.status === 'returnPending') {
    return {
      text: owner ? `${name} says it’s back` : `Waiting for ${name} to confirm`,
      overdue: false,
    };
  }
  if (inPickupWindow(l, now)) {
    return {
      text: owner ? `Waiting for ${name} to pick up` : `Pick up from ${name}`,
      overdue: false,
    };
  }
  // QA B1: the owner said "Not back yet" after I marked it returned.
  const who =
    !owner && l.status === 'active' && l.notBackYetAt
      ? `${name} hasn’t got it back yet`
      : owner
        ? `with ${name}`
        : `from ${name}`;
  if (!l.dueDate) return { text: who, overdue: false };
  const s = dueState(l.dueDate, now);
  if (s.kind === 'overdue') {
    return { text: `${who} · ${s.days} day${s.days === 1 ? '' : 's'} overdue`, overdue: true };
  }
  return { text: `${who} · ${dueLabel(l.dueDate, now)}`, overdue: false };
}

/** "asked 2 days ago · expires in 5 days" for Your requests. */
export function requestRowLine(l: Loan, other: string, now: Date = new Date()): string {
  return [
    `You asked ${first(other)}`,
    l.requestedAt ? timeAgo(l.requestedAt, now) : null,
    expiryLabel(l, now),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * One line for a Recent or History row, from my point of view (E4 table, F6 wording).
 * `other` is the other person's display name; `backAround` is the copy's due date, when known,
 * for "Lent to someone else · back around 12 Dec".
 */
export function recentLine(
  l: Loan,
  uid: string,
  other: string,
  opts: { backAround?: Date | null; now?: Date } = {}
): string {
  const owner = l.ownerId === uid;
  const name = first(other);
  switch (l.status) {
    case 'declined':
      if (owner) {
        return l.declineReason === 'lentToSomeoneElse'
          ? `Lent to someone else · ${name} was told`
          : `You declined ${name}’s request`;
      }
      return declinedLine(l.declineReason, other, opts);
    case 'expired':
      return owner ? `You didn’t answer ${name}’s request` : 'Your request expired';
    case 'cancelled':
      if (isNotCollected(l))
        return owner ? `Not collected by ${name}` : `Not collected from ${name}`;
      // The copy was deleted while requested (QA B16).
      if (l.closedReason === 'copyRemoved')
        return owner ? 'Request cancelled · copy removed' : `${name} removed the book`;
      return owner ? `${name} cancelled the request` : 'You cancelled your request';
    case 'returned':
      return owner ? `Back from ${name}` : `Returned to ${name}`;
    case 'ownerLeft':
      return `${name} left LendShelf`;
    case 'requested':
      return owner ? `${name} asked` : `You asked ${name}`;
    case 'active':
      return owner ? `With ${name}` : `From ${name}`;
    case 'returnPending':
      return owner ? `${name} says it’s back` : `Waiting for ${name} to confirm`;
  }
}
