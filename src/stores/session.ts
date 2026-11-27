/**
 * Signed-in user, their profile and their links (people they have saved). Fed by
 * `<SessionBootstrap />` in the root layout; read through hooks in `@/hooks`.
 */
import type { Href } from 'expo-router';
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
  /**
   * True while deleteAccount runs. The server removes the profile before the Auth user, so
   * without this the app would briefly route to the "What's your name?" onboarding screen
   * (and finishing it would recreate data for the account being deleted).
   */
  deletingAccount: boolean;
  /**
   * A screen to open once the app is usable: a push tap or `lendshelf://` link that arrived while
   * signed out or mid-onboarding (UX §F1 rule 4). Opened and cleared by the signed-in layout.
   */
  pendingHref: Href | null;
  setPendingHref(href: Href | null): void;
  setUser(user: AuthUser | null): void;
  setDeletingAccount(deleting: boolean): void;
  setProfile(profile: WithId<Profile> | null): void;
  setLinks(links: WithId<Link>[], error?: Error | null): void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  user: null,
  authLoading: true,
  profile: null,
  profileLoading: false,
  links: [],
  linksLoading: false,
  linksError: null,
  deletingAccount: false,
  pendingHref: null,
  setPendingHref(pendingHref) {
    set({ pendingHref });
  },
  setUser(user) {
    // Signing out drops a target meant for the previous account; one kept while signed out stays.
    const signingOut = !user && !!get().user;
    set({
      ...(signingOut ? { pendingHref: null } : {}),
      deletingAccount: false,
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
    // Keep the last profile while the account is being deleted (see deletingAccount).
    if (!profile && get().deletingAccount) set({ profileLoading: false });
    else set({ profile, profileLoading: false });
  },
  setDeletingAccount(deletingAccount) {
    set({ deletingAccount });
  },
  setLinks(links, error = null) {
    set({ links, linksLoading: false, linksError: error });
  },
}));

export function selectStatus(s: SessionState): SessionStatus {
  if (s.authLoading) return 'loading';
  if (!s.user) return 'signedOut';
  if (s.profileLoading) return 'loading';
  // A new user has no named profile until the name step (completeProfile) writes it; until
  // then the app shows that step.
  return s.profile?.name?.trim() ? 'ready' : 'needsProfile';
}

/**
 * Where a blocked signed-in route (`(app)`) sends the user. Always a plain path: Expo Router's
 * own fallback carries the blocked route's params along, so a link to `/loan/abc` opened before
 * the contacts step landed on `/contacts?loanId=abc`. The link itself is kept as `pendingHref`
 * and opened once the step is done (F1 rule 4).
 */
export function appGuardRedirect(
  status: SessionStatus,
  needsContacts: boolean
): '/phone' | '/contacts' | undefined {
  if (status === 'signedOut') return '/phone';
  if (status === 'ready' && needsContacts) return '/contacts';
  return undefined;
}

/** Current uid outside React (throws when signed out; only call from signed-in screens). */
export function requireUid(): string {
  const uid = useSessionStore.getState().user?.uid;
  if (!uid) throw new Error('Not signed in');
  return uid;
}
