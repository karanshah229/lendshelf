/**
 * What deleting my account does to my loans (UX §E15, C6), from loans already on the device.
 * Pure, so the sheet's text can be tested.
 */
import type { Loan, WithId } from '@/types/model';

type L = WithId<Loan>;

export interface DeletePrecheck {
  /** My books out with app users: they'll see "<me> left LendShelf" (ownerLeft), without my number. */
  outWithFriends: L[];
  /** My books lent to people who aren't on LendShelf: deleted with the account. */
  lentToNonApp: L[];
  /** Books I have from others: they keep my name on their record. */
  borrowing: L[];
  /** Open requests, either direction: cancelled. */
  openRequests: number;
}

const open = (l: Loan) => l.status === 'active' || l.status === 'returnPending';

export function deletePrecheck(
  uid: string,
  asOwner: readonly L[],
  asBorrower: readonly L[]
): DeletePrecheck {
  const seen = new Set<string>();
  const all = [...asOwner, ...asBorrower].filter((l) => !seen.has(l.id) && !!seen.add(l.id));
  const mine = all.filter((l) => l.ownerId === uid);
  const borrowed = all.filter((l) => l.borrowerUid === uid && l.ownerId !== uid);
  return {
    outWithFriends: mine.filter((l) => open(l) && !!l.borrowerUid),
    lentToNonApp: mine.filter((l) => open(l) && !l.borrowerUid),
    borrowing: borrowed.filter(open),
    openRequests: all.filter(
      (l) => l.status === 'requested' && (l.ownerId === uid || l.borrowerUid === uid)
    ).length,
  };
}

export function hasLoanImpact(p: DeletePrecheck): boolean {
  return p.outWithFriends.length + p.lentToNonApp.length + p.borrowing.length + p.openRequests > 0;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Heading line for the books out with friends. */
export function outWithFriendsLine(n: number): string {
  return `${n} ${plural(n, 'book is', 'books are')} out with friends. They’ll see that you left LendShelf, without your number. Tell them first?`;
}

export function openRequestsLine(n: number): string {
  return `Your ${n} open ${plural(n, 'request', 'requests')} will be cancelled.`;
}
