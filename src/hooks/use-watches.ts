import { useMemo } from 'react';

import { useQueryData } from '@/hooks/use-firestore';
import { collection, db, query, where } from '@/lib/firebase';
import { useSessionStore } from '@/stores/session';
import { COLLECTIONS, type Watch } from '@/types/model';

/** My watches: wishlist Books and "notify me when this copy is back". */
export function useWatches() {
  const uid = useSessionStore((s) => s.user?.uid);
  const res = useQueryData<Watch>(uid ? `watches:${uid}` : null, () =>
    query(collection(db, COLLECTIONS.watches), where('uid', '==', uid))
  );
  return useMemo(() => {
    const watches = [...res.data].sort(
      (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
    );
    return {
      watches,
      wishlist: watches.filter((w) => w.type === 'wishlist'),
      back: watches.filter((w) => w.type === 'back'),
      /** Is this Book on my wishlist? */
      isWishlisted: (workId: string) =>
        watches.some((w) => w.type === 'wishlist' && w.targetId === workId),
      /** Am I watching for this copy to come back? */
      isWatchingBack: (itemId: string) =>
        watches.some((w) => w.type === 'back' && w.targetId === itemId),
      loading: res.loading,
      error: res.error,
    };
  }, [res.data, res.loading, res.error]);
}
