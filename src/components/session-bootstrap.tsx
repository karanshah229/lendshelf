import { useEffect } from 'react';

import { collection, db, doc, onAuthStateChanged, onSnapshot, query, where } from '@/lib/firebase';
import { syncContactsNow } from '@/lib/sync-contacts';
import { useContactsStore } from '@/stores/contacts';
import { useProfilesStore } from '@/stores/profiles';
import { selectStatus, useSessionStore } from '@/stores/session';
import { COLLECTIONS, fromQuerySnap, fromSnap, type Link, type Profile } from '@/types/model';

/**
 * Keeps the session store in sync with Firebase: auth state, my profile, my links.
 * Also re-syncs contacts once per sign-in when onboarding is done. Renders nothing.
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
  const onboarded = useContactsStore((s) => (uid ? !!s.onboarded[uid] : false));
  useEffect(() => {
    if (ready && onboarded) syncContactsNow().catch(() => {});
  }, [ready, onboarded, uid]);

  return null;
}
