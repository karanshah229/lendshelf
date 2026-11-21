import { useEffect } from 'react';

import { collection, db, doc, onAuthStateChanged, onSnapshot, query, where } from '@/lib/firebase';
import { useContactsAutoResync } from '@/features/contacts/use-auto-resync';
import { registerCircleNames } from '@/hooks/use-links';
import { useContactsStore } from '@/stores/contacts';
import { useProfilesStore } from '@/stores/profiles';
import { selectStatus, useSessionStore } from '@/stores/session';
import { COLLECTIONS, fromQuerySnap, fromSnap, type Link, type Profile } from '@/types/model';

// Short names are kept unique across my circle (QA Android #4).
registerCircleNames();

/**
 * Keeps the session store in sync with Firebase: auth state, my profile, my links.
 * Also re-syncs contacts silently on open and on foreground, at most once a day and native
 * only (UX §E13). Renders nothing.
 */
export function SessionBootstrap() {
  useEffect(
    () =>
      onAuthStateChanged((user) => {
        const previous = useSessionStore.getState().user;
        if (previous?.uid === user?.uid && !useSessionStore.getState().authLoading) return;
        useSessionStore.getState().setUser(user);
        if (!user || (previous && previous.uid !== user.uid)) {
          useContactsStore.getState().reset();
          useProfilesStore.getState().clear();
        }
        useContactsStore.getState().setCurrentUid(user?.uid ?? null);
      }),
    []
  );

  const uid = useSessionStore((s) => s.user?.uid);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, COLLECTIONS.profiles, uid),
      (snap) => useSessionStore.getState().setProfile(fromSnap<Profile>(snap)),
      () => useSessionStore.getState().setProfile(null)
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, COLLECTIONS.links), where('viewerId', '==', uid)),
      (snap) => useSessionStore.getState().setLinks(fromQuerySnap<Link>(snap)),
      (error) => useSessionStore.getState().setLinks([], error)
    );
  }, [uid]);

  const ready = useSessionStore((s) => selectStatus(s) === 'ready');
  useContactsAutoResync(uid, ready);

  return null;
}
