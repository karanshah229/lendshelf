/**
 * Requests, pure (UX §E4, §E5, R14): decline-reason wording, the "two requests for one Book"
 * checks and the retry rules after a lost response. No Firebase, so every case is testable.
 */
import { formatShortDate } from '@/lib/dates';
import type { DeclineReason, Loan, WithId } from '@/types/model';

import { joinNames, shortName, shortNames } from '@/features/shared/people';

type L = WithId<Loan>;

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const first = shortName;

// ---------- Decline reasons (E5 owner sheet, E4 borrower wording) ----------

/** The owner's decline sheet chips, in order. */
export const DECLINE_REASONS: readonly { value: DeclineReason; label: string }[] = [
  { value: 'readingIt', label: 'I’m reading it' },
  { value: 'notLending', label: 'Not lending this one' },
  { value: 'lentToSomeoneElse', label: 'Lent to someone else' },
];

/**
 * What the borrower reads for a declined request, by reason (E4 table, F6):
 * "Ravi is reading it right now" · "Ravi isn't lending it at the moment" ·
 * "Lent to someone else · back around 12 Dec" (never who has it) · "Ravi can't lend it right now".
 * `backAround` is the copy's due date, only when the borrower can still read the copy.
 */
export function declinedLine(
  reason: DeclineReason | null | undefined,
  ownerName: string,
  opts: { backAround?: Date | null; now?: Date } = {}
): string {
  const name = first(ownerName);
  switch (reason) {
    case 'readingIt':
      return `${name} is reading it right now`;
    case 'notLending':
      return `${name} isn’t lending it at the moment`;
    case 'lentToSomeoneElse':
      return opts.backAround
        ? `Lent to someone else · back around ${formatShortDate(opts.backAround, opts.now)}`
        : 'Lent to someone else';
    default:
      return `${name} can’t lend it right now`;
  }
}

/**
 * "Back around …" for a request that was lent to someone else: the copy's due date, while it is
 * out with someone other than me (it may since have been lent to me). Null when unknown.
 */
export function backAroundFor(
  item: {
    loanState: string;
    dueDate: { toDate(): Date } | null;
    activeLoanId: string | null;
  } | null,
  myLoanIds: ReadonlySet<string>
): Date | null {
  if (!item || item.loanState !== 'lent' || !item.dueDate) return null;
  if (item.activeLoanId && myLoanIds.has(item.activeLoanId)) return null;
  return item.dueDate.toDate();
}

// ---------- Two requests for one copy (E5) ----------

/** Open requests for the same copy as `loan`, other than `loan` itself, oldest first. */
export function otherRequestsForCopy(loan: Pick<L, 'id' | 'itemId'>, requests: readonly L[]): L[] {
  return requests
    .filter((l) => l.itemId === loan.itemId && l.id !== loan.id && l.status === 'requested')
    .sort((a, b) => (a.requestedAt?.toMillis() ?? 0) - (b.requestedAt?.toMillis() ?? 0));
}

/**
 * The due-date sheet's warning when accepting one of several requests (E5):
 * "Kabir’s request will be declined. They’ll be told it went to someone else, and we’ll tell
 * them when it’s back." Null when nobody else asked.
 */
export function acceptDeclinesWarning(otherNames: readonly string[]): string | null {
  const names = shortNames(otherNames);
  if (!names.length) return null;
  const who =
    names.length === 1
      ? `${names[0]}’s request will be declined.`
      : `Requests from ${joinNames(names, 10)} will be declined.`;
  return `${who} They’ll be told it went to someone else, and we’ll tell them when it’s back.`;
}

/**
 * The Lend screen's warning when the copy has open requests (E7): "Kabir asked for this. Their
 * request will be declined." Null without requests.
 */
export function lendDeclinesWarning(requesterNames: readonly string[]): string | null {
  const names = shortNames(requesterNames);
  if (!names.length) return null;
  return names.length === 1
    ? `${names[0]} asked for this. Their request will be declined.`
    : `${joinNames(names, 10)} asked for this. Their requests will be declined.`;
}

// ---------- R14: two requests for one Book (borrower side) ----------

/**
 * "Asha said yes to Sapiens. Cancel your request to Kabir?" (R14): for each of my requests that
 * is still open while another of my requests for the same Book was accepted (now active).
 * Returns the request to cancel with the loan that was accepted. Same Book = same `workId`.
 */
export function otherOpenRequestsAfterAccept(
  uid: string,
  myBorrowerLoans: readonly L[]
): { request: L; accepted: L }[] {
  const mine = myBorrowerLoans.filter((l) => l.borrowerUid === uid && l.ownerId !== uid);
  const accepted = mine.filter((l) => l.status === 'active' && !!l.requestedAt);
  const out: { request: L; accepted: L }[] = [];
  const seen = new Set<string>();
  for (const r of mine) {
    if (r.status !== 'requested' || seen.has(r.id)) continue;
    const yes = accepted.find((a) => a.workId === r.workId && a.itemId !== r.itemId);
    if (yes) {
      seen.add(r.id);
      out.push({ request: r, accepted: yes });
    }
  }
  return out;
}

/**
 * The Ask sheet's R14 warning: I already have an open request, or the book itself, for this Book
 * from someone else. Requests and loans of the same copy are excluded (the copy page already
 * blocks Ask for those). A loan I have beats a request.
 */
export function askConflict(
  target: { itemId: string; workId: string | null | undefined },
  uid: string,
  myBorrowerLoans: readonly L[]
): { kind: 'borrowing' | 'requested'; loan: L } | null {
  if (!target.workId) return null;
  const same = myBorrowerLoans.filter(
    (l) =>
      l.borrowerUid === uid &&
      l.workId === target.workId &&
      l.itemId !== target.itemId &&
      l.ownerId !== uid
  );
  const borrowing = same.find((l) => l.status === 'active' || l.status === 'returnPending');
  if (borrowing) return { kind: 'borrowing', loan: borrowing };
  const requested = same.find((l) => l.status === 'requested');
  return requested ? { kind: 'requested', loan: requested } : null;
}

/** Text for `askConflict`: "You’ve already asked Kabir for this." / "You already have this from Kabir." */
export function askConflictText(kind: 'borrowing' | 'requested', ownerName: string): string {
  const name = first(ownerName);
  return kind === 'requested'
    ? `You’ve already asked ${name} for this. If ${name} says yes too, you can cancel one.`
    : `You already have this book from ${name}.`;
}

// ---------- Retries after a lost response (E4, E5) ----------

/** After `requestLoan` fails with `already-exists`: my open request for that copy, if loaded. */
export function existingRequestFor(
  itemId: string,
  uid: string,
  myBorrowerLoans: readonly L[]
): L | null {
  return (
    myBorrowerLoans.find(
      (l) => l.itemId === itemId && l.borrowerUid === uid && l.status === 'requested'
    ) ?? null
  );
}

/**
 * After accept fails (the first try may have gone through and only the response was lost):
 * the request counts as accepted when the loan, read again, is active or already further on.
 */
export function acceptAlreadyDone(loanNow: Pick<Loan, 'status'> | null | undefined): boolean {
  return loanNow?.status === 'active' || loanNow?.status === 'returnPending';
}
