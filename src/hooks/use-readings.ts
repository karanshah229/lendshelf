import { useMemo } from 'react';

import { useMergedQueries, useQueryData } from '@/hooks/use-firestore';
import { useLinks } from '@/hooks/use-links';
import { collection, db, query, where } from '@/lib/firebase';
import { useSessionStore } from '@/stores/session';
import { COLLECTIONS, type Reading, type WithId } from '@/types/model';

const byUid = (uid: string) => query(collection(db, COLLECTIONS.readings), where('uid', '==', uid));

/** My reading: books I'm reading now and the ones I've finished (live). */
export function useMyReadings(): { readings: WithId<Reading>[]; loading: boolean } {
  const uid = useSessionStore((s) => s.user?.uid);
  const res = useQueryData<Reading>(uid ? `readings|${uid}` : null, () => byUid(uid!));
  return { readings: res.data, loading: res.loading };
}

/**
 * One contact's reading. `hidden` when they've turned sharing off (rules refuse the query);
 * any other error also shows nothing, since reading is never essential to a screen.
 */
export function useReadingsOf(uid: string | null | undefined): {
  readings: WithId<Reading>[];
  loading: boolean;
  hidden: boolean;
} {
  const res = useQueryData<Reading>(uid ? `readings|${uid}` : null, () => byUid(uid!));
  return { readings: res.data, loading: res.loading, hidden: !!res.error };
}

/**
 * What everyone I have saved is reading: one live query per linked owner. Contacts who
 * turned sharing off refuse the query; they're simply left out.
 */
export function useCircleReadings(): { readings: WithId<Reading>[]; loading: boolean } {
  const { links, loading: linksLoading } = useLinks();
  const ownerIds = useMemo(() => links.map((l) => l.ownerId), [links]);
  const res = useMergedQueries<Reading>(linksLoading ? null : ownerIds, byUid);
  return { readings: res.data, loading: linksLoading || res.loading };
}
