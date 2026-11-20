import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useDocData } from '@/hooks/use-firestore';
import { selectStatus, useSessionStore, type SessionStatus } from '@/stores/session';
import { useProfilesStore, type ProfileSummary } from '@/stores/profiles';
import { COLLECTIONS, type Profile, type UserDoc, type WithId } from '@/types/model';

/** The signed-in user (`null` when signed out) and whether auth state is still loading. */
export function useAuth() {
  return useSessionStore(useShallow((s) => ({ user: s.user, loading: s.authLoading })));
}

/** The signed-in user's uid. Only use in screens behind the auth gate. */
export function useUid(): string {
  const uid = useSessionStore((s) => s.user?.uid);
  if (!uid) throw new Error('useUid() used while signed out');
  return uid;
}

/** 'loading' | 'signedOut' | 'needsProfile' | 'ready' — drives the auth gate. */
export function useSessionStatus(): SessionStatus {
  return useSessionStore(selectStatus);
}

/** My own profile (live). */
export function useMyProfile(): { profile: WithId<Profile> | null; loading: boolean } {
  return useSessionStore(useShallow((s) => ({ profile: s.profile, loading: s.profileLoading })));
}

/**
 * Profile summary (name, pickup note) for any user. For yourself, returns your live profile.
 * Other users' profiles are read once per session and cached.
 */
export function useProfile(uid: string | null | undefined): {
  profile: ProfileSummary | null;
  loading: boolean;
} {
  const me = useSessionStore((s) => s.user?.uid);
  const mine = useSessionStore((s) => s.profile);
  const isMe = !!uid && uid === me;
  const cached = useProfilesStore((s) => (uid ? s.byUid[uid] : undefined));
  const fetched = useProfilesStore((s) => (uid ? !!s.fetched[uid] : true));

  useEffect(() => {
    if (uid && !isMe) void useProfilesStore.getState().ensure([uid]);
  }, [uid, isMe]);

  if (isMe)
    return {
      profile: mine ? { name: mine.name, pickupNote: mine.pickupNote } : null,
      loading: false,
    };
  return { profile: cached ?? null, loading: !!uid && !fetched && !cached };
}

/** My private `users/{uid}` document (phone, push tokens). */
export function useMyUserDoc() {
  const uid = useSessionStore((s) => s.user?.uid);
  return useDocData<UserDoc>(uid ? `${COLLECTIONS.users}/${uid}` : null);
}
