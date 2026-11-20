import { useCallback, useMemo } from 'react';

import { useMyItems, useNetworkItems } from '@/hooks/use-items';
import { useLinkMap } from '@/hooks/use-links';
import { useMyLoans } from '@/hooks/use-loans';
import { useProfilesStore } from '@/stores/profiles';

/** My copies plus contacts' shared copies (newest first), deduplicated. */
export function useCircleItems() {
  const mine = useMyItems();
  const network = useNetworkItems();
  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...mine.items, ...network.items].filter((i) =>
      seen.has(i.id) ? false : (seen.add(i.id), true)
    );
  }, [mine.items, network.items]);
  return {
    items,
    myItems: mine.items,
    networkItems: network.items,
    loading: mine.loading || network.loading,
  };
}

/** Item ids I have an open borrow request for. */
export function useRequestedItemIds(): ReadonlySet<string> {
  const { asBorrower } = useMyLoans();
  return useMemo(
    () => new Set(asBorrower.filter((l) => l.status === 'requested').map((l) => l.itemId)),
    [asBorrower]
  );
}

/** Name lookup for owners: my contact name → their profile name → "Someone". */
export function useNameOf(): (uid: string) => string {
  const linkMap = useLinkMap();
  const profiles = useProfilesStore((s) => s.byUid);
  return useCallback(
    (uid: string) => linkMap.get(uid)?.displayName ?? profiles[uid]?.name ?? 'Someone',
    [linkMap, profiles]
  );
}
