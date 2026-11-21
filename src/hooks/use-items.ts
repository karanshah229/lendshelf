import { useMemo } from 'react';

import { useDocData, useMergedQueries, useQueryData } from '@/hooks/use-firestore';
import { useLinks } from '@/hooks/use-links';
import { collection, db, query, where } from '@/lib/firebase';
import { useSessionStore } from '@/stores/session';
import { COLLECTIONS, type Item, type WithId } from '@/types/model';

const newestFirst = (a: WithId<Item>, b: WithId<Item>) =>
  (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);

/** All my copies, newest first. */
export function useMyItems() {
  const uid = useSessionStore((s) => s.user?.uid);
  const res = useQueryData<Item>(uid ? `items:${uid}` : null, () =>
    query(collection(db, COLLECTIONS.items), where('ownerId', '==', uid))
  );
  const items = useMemo(() => [...res.data].sort(newestFirst), [res.data]);
  return { items, loading: res.loading, error: res.error, retry: res.retry };
}

/**
 * Copies shared with me by everyone I have saved: one live query per linked owner
 * (`items where ownerId == X && sharedWithContacts == true`), merged, newest first.
 */
export function useNetworkItems() {
  const { links, loading: linksLoading } = useLinks();
  const ownerIds = useMemo(() => links.map((l) => l.ownerId), [links]);
  const res = useMergedQueries<Item>(linksLoading ? null : ownerIds, (ownerId) =>
    query(
      collection(db, COLLECTIONS.items),
      where('ownerId', '==', ownerId),
      where('sharedWithContacts', '==', true)
    )
  );
  const items = useMemo(() => [...res.data].sort(newestFirst), [res.data]);
  return { items, loading: linksLoading || res.loading, error: res.error, retry: res.retry };
}

/** Shared copies of one contact. */
export function useOwnerItems(ownerId: string | null | undefined) {
  const res = useQueryData<Item>(ownerId ? `ownerItems:${ownerId}` : null, () =>
    query(
      collection(db, COLLECTIONS.items),
      where('ownerId', '==', ownerId),
      where('sharedWithContacts', '==', true)
    )
  );
  const items = useMemo(() => [...res.data].sort(newestFirst), [res.data]);
  return { items, loading: res.loading, error: res.error };
}

/** One copy (mine, or a contact's shared copy). */
export function useItem(itemId: string | null | undefined) {
  const res = useDocData<Item>(itemId ? `${COLLECTIONS.items}/${itemId}` : null);
  return { item: res.data, loading: res.loading, error: res.error };
}
