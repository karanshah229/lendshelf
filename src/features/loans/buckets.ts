/**
 * Pure loan bucketing for the Loans tab: which loans go into Requests / Lent out / Borrowed,
 * how they are ordered, and what goes into each segment's History.
 */
import { addDays, calendarDaysBetween } from '@/lib/dates';
import { REQUEST_EXPIRY_DAYS, type Loan, type LoanStatus, type WithId } from '@/types/model';

export type LoanSegment = 'requests' | 'lent' | 'borrowed';

export interface LoanBuckets {
  /** Requests on my copies, waiting for my answer (oldest first: they expire first). */
  incoming: WithId<Loan>[];
  /** My own pending requests on other people's copies (newest first). */
  outgoing: WithId<Loan>[];
  /** My copies that are with someone: "says returned" first, then by due date. */
  lent: WithId<Loan>[];
  /** Books I have right now: "waiting for confirmation" last, otherwise by due date. */
  borrowed: WithId<Loan>[];
  /** Closed loans per segment, newest first. */
  history: Record<LoanSegment, WithId<Loan>[]>;
  /** Count shown on each segment control. */
  counts: Record<LoanSegment, number>;
}

const REQUEST_HISTORY: readonly LoanStatus[] = ['declined', 'cancelled', 'expired'];

const millis = (t: { toMillis(): number } | null | undefined, fallback = 0) =>
  t ? t.toMillis() : fallback;

const requestedMs = (l: Loan) => millis(l.requestedAt, millis(l.updatedAt));
const updatedMs = (l: Loan) => millis(l.returnedAt) || millis(l.updatedAt) || millis(l.requestedAt);
/** Loans without a due date sort after dated ones. */
const dueMs = (l: Loan) => millis(l.dueDate, Number.MAX_SAFE_INTEGER);

/** Buckets my loans. `asOwner`/`asBorrower` come from `useMyLoans()`; duplicates are ignored. */
export function bucketLoans(
  uid: string,
  asOwner: readonly WithId<Loan>[],
  asBorrower: readonly WithId<Loan>[]
): LoanBuckets {
  const seen = new Set<string>();
  const all: WithId<Loan>[] = [];
  for (const l of [...asOwner, ...asBorrower]) {
    if (seen.has(l.id)) continue;
    seen.add(l.id);
    all.push(l);
  }
  const mineAsOwner = all.filter((l) => l.ownerId === uid);
  const mineAsBorrower = all.filter((l) => l.borrowerUid === uid && l.ownerId !== uid);

  const incoming = mineAsOwner
    .filter((l) => l.status === 'requested')
    .sort((a, b) => requestedMs(a) - requestedMs(b));
  const outgoing = mineAsBorrower
    .filter((l) => l.status === 'requested')
    .sort((a, b) => requestedMs(b) - requestedMs(a));

  const lent = mineAsOwner
    .filter((l) => l.status === 'active' || l.status === 'returnPending')
    .sort((a, b) => {
      const pa = a.status === 'returnPending' ? 0 : 1;
      const pb = b.status === 'returnPending' ? 0 : 1;
      return pa - pb || dueMs(a) - dueMs(b);
    });
  const borrowed = mineAsBorrower
    .filter((l) => l.status === 'active' || l.status === 'returnPending')
    .sort((a, b) => {
      const pa = a.status === 'returnPending' ? 1 : 0;
      const pb = b.status === 'returnPending' ? 1 : 0;
      return pa - pb || dueMs(a) - dueMs(b);
    });

  const newest = (a: WithId<Loan>, b: WithId<Loan>) => updatedMs(b) - updatedMs(a);
  const history: Record<LoanSegment, WithId<Loan>[]> = {
    requests: all.filter((l) => REQUEST_HISTORY.includes(l.status)).sort(newest),
    lent: mineAsOwner.filter((l) => l.status === 'returned').sort(newest),
    borrowed: mineAsBorrower.filter((l) => l.status === 'returned').sort(newest),
  };

  return {
    incoming,
    outgoing,
    lent,
    borrowed,
    history,
    counts: {
      requests: incoming.length + outgoing.length,
      lent: lent.length,
      borrowed: borrowed.length,
    },
  };
}

/** The segment to open first: requests waiting for me, else whatever has something in it. */
export function initialSegment(b: Pick<LoanBuckets, 'incoming' | 'counts'>): LoanSegment {
  if (b.incoming.length) return 'requests';
  if (b.counts.lent) return 'lent';
  if (b.counts.borrowed) return 'borrowed';
  return 'requests';
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

/**
 * Whether tapping the loan can open the copy page: always for my own copies; for a borrowed
 * copy only while I still have the owner saved (otherwise rules hide the copy).
 */
export function canOpenCopy(
  loan: Pick<Loan, 'ownerId' | 'itemId'>,
  uid: string,
  linkedOwnerIds: ReadonlySet<string>
): boolean {
  if (!loan.itemId) return false;
  return loan.ownerId === uid || linkedOwnerIds.has(loan.ownerId);
}

/** Short history line, e.g. "Returned", "Declined", "Expired". */
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
  }
}
