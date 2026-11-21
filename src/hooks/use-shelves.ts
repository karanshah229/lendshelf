import { useMemo } from 'react';

import { useQueryData } from '@/hooks/use-firestore';
import { collection, db, query, where } from '@/lib/firebase';
import { useSessionStore } from '@/stores/session';
import { COLLECTIONS, type Shelf, type WithId } from '@/types/model';

import { shelfDisplayName } from '@/features/library/filter';

const bySortOrder = (a: WithId<Shelf>, b: WithId<Shelf>) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/**
 * Collections as shown in the UI: the default one still named "My books" is displayed as
 * "Main shelf" (UX F6, C1). Display only; nothing is written back.
 */
const forDisplay = (shelves: readonly WithId<Shelf>[]): WithId<Shelf>[] =>
  shelves.map((s) => {
    const name = shelfDisplayName(s);
    return name === s.name ? s : { ...s, name };
  });

/** My collections, in display order. */
export function useMyShelves() {
  const uid = useSessionStore((s) => s.user?.uid);
  const res = useQueryData<Shelf>(uid ? `shelves:${uid}` : null, () =>
    query(collection(db, COLLECTIONS.shelves), where('ownerId', '==', uid))
  );
  const shelves = useMemo(() => forDisplay([...res.data].sort(bySortOrder)), [res.data]);
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
  const shelves = useMemo(() => forDisplay([...res.data].sort(bySortOrder)), [res.data]);
  return { shelves, loading: res.loading, error: res.error };
}
