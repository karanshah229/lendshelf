import { useEffect, useMemo, useState } from 'react';

import { bucketLoans } from '@/features/loans/buckets';
import { needsYou } from '@/features/loans/needs-you';
import { useMyLoans } from '@/hooks/use-loans';
import { useDismissedStore } from '@/stores/dismissed';
import { useSessionStore } from '@/stores/session';

/**
 * The current time, refreshed every `intervalMs` (default 1 min), so time-based wording (the
 * 48 h pick-up window, "due tomorrow") switches without a data change.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * My Needs-you cards and the Loans ledger, live. Shared by the Loans tab, its badge and
 * Home: `cards.length` is the badge.
 */
export function useNeedsYou() {
  const uid = useSessionStore((s) => s.user?.uid) ?? '';
  const loans = useMyLoans();
  const now = useNow();
  const dismissedKeys = useDismissedStore((s) => s.keys);
  const { asOwner, asBorrower } = loans;
  const cards = useMemo(
    () =>
      uid ? needsYou(uid, asOwner, asBorrower, now, { dismissed: new Set(dismissedKeys) }) : [],
    [uid, asOwner, asBorrower, now, dismissedKeys]
  );
  const ledger = useMemo(
    () => bucketLoans(uid, asOwner, asBorrower, now),
    [uid, asOwner, asBorrower, now]
  );
  return { ...loans, uid, now, cards, ledger };
}
