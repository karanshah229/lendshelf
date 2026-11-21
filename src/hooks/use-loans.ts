import { useMemo } from 'react';

import { useDocData, useQueryData } from '@/hooks/use-firestore';
import { collection, db, query, where } from '@/lib/firebase';
import { useSessionStore } from '@/stores/session';
import { COLLECTIONS, OPEN_LOAN_STATUSES, type Loan, type WithId } from '@/types/model';

const recentFirst = (a: WithId<Loan>, b: WithId<Loan>) =>
  (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0);

const isOpen = (l: Loan) => OPEN_LOAN_STATUSES.includes(l.status);

/**
 * My loans, live: `asOwner` (loans where ownerId == me) and `asBorrower`
 * (loans where borrowerUid == me), plus convenient open-loan buckets for the Loans tab.
 */
export function useMyLoans() {
  const uid = useSessionStore((s) => s.user?.uid);
  const owner = useQueryData<Loan>(uid ? `loansOwner:${uid}` : null, () =>
    query(collection(db, COLLECTIONS.loans), where('ownerId', '==', uid))
  );
  const borrower = useQueryData<Loan>(uid ? `loansBorrower:${uid}` : null, () =>
    query(collection(db, COLLECTIONS.loans), where('borrowerUid', '==', uid))
  );

  const { retry: retryOwner } = owner;
  const { retry: retryBorrower } = borrower;

  return useMemo(() => {
    const asOwner = [...owner.data].sort(recentFirst);
    const asBorrower = [...borrower.data].sort(recentFirst);
    return {
      asOwner,
      asBorrower,
      /** Requests waiting for my answer. */
      incomingRequests: asOwner.filter((l) => l.status === 'requested'),
      /** My copies currently with someone else. */
      lentOut: asOwner.filter((l) => l.status === 'active' || l.status === 'returnPending'),
      /** Books I have, or have asked for. */
      borrowed: asBorrower.filter(isOpen),
      loading: owner.loading || borrower.loading,
      error: owner.error ?? borrower.error,
      /** Re-subscribes the failed listener(s). */
      retry: () => {
        if (owner.error) retryOwner();
        if (borrower.error) retryBorrower();
      },
    };
  }, [
    owner.data,
    owner.loading,
    owner.error,
    retryOwner,
    borrower.data,
    borrower.loading,
    borrower.error,
    retryBorrower,
  ]);
}

/** One loan (owner or borrower only). */
export function useLoan(loanId: string | null | undefined) {
  const res = useDocData<Loan>(loanId ? `${COLLECTIONS.loans}/${loanId}` : null);
  return { loan: res.data, loading: res.loading, error: res.error };
}
