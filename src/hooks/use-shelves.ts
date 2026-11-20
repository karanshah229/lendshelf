import { useMemo } from 'react';

import { useQueryData } from '@/hooks/use-firestore';
import { collection, db, query, where } from '@/lib/firebase';
import { useSessionStore } from '@/stores/session';
import { COLLECTIONS, type Shelf, type WithId } from '@/types/model';

const bySortOrder = (a: WithId<Shelf>, b: WithId<Shelf>) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/** My collections, in display order. */
export function useMyShelves() {
  const uid = useSessionStore((s) => s.user?.uid);
  const res = useQueryData<Shelf>(uid ? `shelves:${uid}` : null, () =>
    query(collection(db, COLLECTIONS.shelves), where('ownerId', '==', uid))
  );
  const shelves = useMemo(() => [...res.data].sort(bySortOrder), [res.data]);
  return { shelves, loading: res.loading, error: res.error };
}

/** A contact's public collections (rules allow: isPublic && I have them saved). */
export function usePublicShelves(ownerId: string | null | undefined) {
  const res = useQueryData<Shelf>(ownerId ? `publicShelves:${ownerId}` : null, () =>
    query(
      collection(db, COLLECTIONS.shelves),
      where('ownerId', '==', ownerId),
      where('isPublic', '==', true)
    )
  );
  const shelves = useMemo(() => [...res.data].sort(bySortOrder), [res.data]);
  return { shelves, loading: res.loading, error: res.error };
}
