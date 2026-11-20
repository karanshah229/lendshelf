import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLinks } from '@/hooks/use-links';
import { db, doc, getDoc } from '@/lib/firebase';
import { useSessionStore } from '@/stores/session';
import { COLLECTIONS, fromSnap, reviewId, type Review, type WithId } from '@/types/model';

export interface VisibleReviews {
  /** Reviews I can see (mine + people I have saved), newest first. */
  reviews: WithId<Review>[];
  myReview: WithId<Review> | null;
  /** Average of the visible ratings (1 decimal), or null when there are none. Computed on device. */
  average: number | null;
  count: number;
  loading: boolean;
  /** Re-reads the reviews (call after writing or deleting a review). */
  refresh(): void;
}

async function readReviews(workId: string, authorIds: string[]): Promise<WithId<Review>[]> {
  const results = await Promise.allSettled(
    authorIds.map((a) => getDoc(doc(db, COLLECTIONS.reviews, reviewId(workId, a))))
  );
  const found: WithId<Review>[] = [];
  for (const r of results) {
    // A missing review may surface as permission-denied; either way there's nothing to show.
    if (r.status === 'fulfilled') {
      const review = fromSnap<Review>(r.value);
      if (review) found.push(review);
    }
  }
  return found.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
}

/**
 * Reviews of a Book that I'm allowed to see. Read by document id
 * (`${workId}_${uid}` for me and each linked owner) because rules can't filter
 * list queries by "author is in my contacts" (DECISIONS #5).
 */
export function useVisibleReviews(workId: string | null | undefined): VisibleReviews {
  const uid = useSessionStore((s) => s.user?.uid);
  const { links, loading: linksLoading } = useLinks();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; reviews: WithId<Review>[] } | null>(null);

  const authorIds = useMemo(
    () => (uid ? [uid, ...links.map((l) => l.ownerId).filter((id) => id !== uid)] : []),
    [uid, links]
  );
  const key = workId && uid && !linksLoading ? `${workId}|${authorIds.join(',')}|${version}` : null;

  useEffect(() => {
    if (!key || !workId) return;
    let cancelled = false;
    void readReviews(workId, authorIds).then((reviews) => {
      if (!cancelled) setState({ key, reviews });
    });
    return () => {
      cancelled = true;
    };
    // `key` covers workId, authorIds and version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const current = !!key && state?.key === key;
  // Keep showing the previous result for the same Book while refreshing.
  const reviews = useMemo(
    () => (state && workId && state.key.startsWith(`${workId}|`) ? state.reviews : []),
    [state, workId]
  );

  return useMemo(() => {
    const myReview = reviews.find((r) => r.authorId === uid) ?? null;
    const average = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;
    return { reviews, myReview, average, count: reviews.length, loading: !current, refresh };
  }, [reviews, uid, current, refresh]);
}
