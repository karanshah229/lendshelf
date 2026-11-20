/**
 * What the copy page shows and allows, derived from the copy, who is looking and their loans.
 * Pure so it can be tested without Firebase.
 */
import { itemStatus, type Item, type ItemStatus, type Loan, type WithId } from '@/types/model';

export type CopyActionItem = WithId<
  Pick<Item, 'ownerId' | 'visibility' | 'loanState' | 'dueDate' | 'activeLoanId'>
>;
export type CopyActionLoan = WithId<Pick<Loan, 'itemId' | 'status'>>;

export interface CopyActionInput {
  item: CopyActionItem;
  uid: string;
  /** Loans where I am the borrower (any item, any status). */
  myBorrowerLoans: readonly CopyActionLoan[];
  /** Am I watching for this copy to come back? */
  watchingBack: boolean;
  /** Do I have the owner's number (needed for WhatsApp)? */
  hasOwnerPhone: boolean;
}

export interface OwnerCopyState {
  role: 'owner';
  status: ItemStatus;
  canLend: boolean;
  /** The active loan to confirm a return on. */
  returnLoanId: string | null;
  canDelete: boolean;
  deleteBlockedReason: string | null;
}

export interface ViewerCopyState {
  role: 'viewer';
  status: ItemStatus;
  /** My open request for this copy. */
  myRequest: CopyActionLoan | null;
  /** My active loan of this copy (I have it). */
  myBorrow: CopyActionLoan | null;
  canAsk: boolean;
  /** Why "Ask to borrow" isn't offered (null when it is). */
  askBlockedReason: string | null;
  /** Show "Notify me when it's back". */
  canNotifyBack: boolean;
  watchingBack: boolean;
  canMessage: boolean;
}

export type CopyState = OwnerCopyState | ViewerCopyState;

export function deriveCopyState({
  item,
  uid,
  myBorrowerLoans,
  watchingBack,
  hasOwnerPhone,
}: CopyActionInput): CopyState {
  if (item.ownerId === uid) {
    const lent = item.loanState === 'lent';
    return {
      role: 'owner',
      status: itemStatus(item),
      canLend: !lent,
      returnLoanId: lent ? item.activeLoanId : null,
      canDelete: !lent,
      deleteBlockedReason: lent ? 'Mark it returned before deleting this copy.' : null,
    };
  }

  const forItem = myBorrowerLoans.filter((l) => l.itemId === item.id);
  const myRequest = forItem.find((l) => l.status === 'requested') ?? null;
  const myBorrow =
    forItem.find((l) => l.status === 'active' || l.status === 'returnPending') ?? null;
  const status = itemStatus(item, { requestedByMe: !!myRequest });
  const lent = item.loanState === 'lent';

  let askBlockedReason: string | null = null;
  if (myBorrow) askBlockedReason = 'You have this copy right now.';
  else if (myRequest) askBlockedReason = 'You’ve already asked for this copy.';
  else if (lent) askBlockedReason = 'It’s lent out at the moment.';
  else if (item.visibility !== 'lendable') askBlockedReason = 'The owner isn’t lending this one.';

  return {
    role: 'viewer',
    status,
    myRequest,
    myBorrow,
    canAsk: askBlockedReason === null,
    askBlockedReason,
    canNotifyBack: lent && !myBorrow,
    watchingBack,
    canMessage: hasOwnerPhone,
  };
}
