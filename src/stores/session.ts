/**
 * Signed-in user, their profile and their links (people they have saved). Fed by
 * `<SessionBootstrap />` in the root layout; read through hooks in `@/hooks`.
 */
import { create } from 'zustand';

import type { AuthUser } from '@/lib/firebase';
import type { Link, Profile, WithId } from '@/types/model';

export type SessionStatus = 'loading' | 'signedOut' | 'needsProfile' | 'ready';

export interface SessionState {
  user: AuthUser | null;
  authLoading: boolean;
  profile: WithId<Profile> | null;
  profileLoading: boolean;
  /** links where viewerId == me (one shared listener for the whole app). */
  links: WithId<Link>[];
  linksLoading: boolean;
  linksError: Error | null;
  setUser(user: AuthUser | null): void;
  setProfile(profile: WithId<Profile> | null): void;
  setLinks(links: WithId<Link>[], error?: Error | null): void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  user: null,
  authLoading: true,
  profile: null,
  profileLoading: false,
  links: [],
  linksLoading: false,
  linksError: null,
  setUser(user) {
    set({
      user,
      authLoading: false,
      profile: null,
      profileLoading: !!user,
      links: [],
      linksLoading: !!user,
      linksError: null,
    });
  },
  setProfile(profile) {
    set({ profile, profileLoading: false });
  },
  setLinks(links, error = null) {
    set({ links, linksLoading: false, linksError: error });
  },
}));

export function selectStatus(s: SessionState): SessionStatus {
  if (s.authLoading) return 'loading';
  if (!s.user) return 'signedOut';
  if (s.profileLoading) return 'loading';
  return s.profile ? 'ready' : 'needsProfile';
}

/** Current uid outside React (throws when signed out; only call from signed-in screens). */
export function requireUid(): string {
  const uid = useSessionStore.getState().user?.uid;
  if (!uid) throw new Error('Not signed in');
  return uid;
}
