import { appGuardRedirect, selectStatus, useSessionStore } from '@/stores/session';
import type { AuthUser } from '@/lib/firebase';
import type { Profile, WithId } from '@/types/model';

const user = { uid: 'u1', phoneNumber: '+919000000001' } as unknown as AuthUser;
const profile = { id: 'u1', name: 'Asha' } as unknown as WithId<Profile>;

describe('session store while deleting the account', () => {
  beforeEach(() => {
    useSessionStore.getState().setUser(user);
    useSessionStore.getState().setProfile(profile);
  });

  it('routes to onboarding when the profile disappears normally', () => {
    useSessionStore.getState().setProfile(null);
    expect(selectStatus(useSessionStore.getState())).toBe('needsProfile');
  });

  it('stays on the name step while the profile has no name yet (onUserCreated stub)', () => {
    useSessionStore.getState().setProfile({ id: 'u1' } as unknown as WithId<Profile>);
    expect(selectStatus(useSessionStore.getState())).toBe('needsProfile');
    useSessionStore.getState().setProfile({ id: 'u1', name: '  ' } as unknown as WithId<Profile>);
    expect(selectStatus(useSessionStore.getState())).toBe('needsProfile');
  });

  it('keeps the profile (and the app) while the account is being deleted', () => {
    useSessionStore.getState().setDeletingAccount(true);
    useSessionStore.getState().setProfile(null);
    expect(useSessionStore.getState().profile).toBe(profile);
    expect(selectStatus(useSessionStore.getState())).toBe('ready');
  });

  it('clears the flag on sign-out', () => {
    useSessionStore.getState().setDeletingAccount(true);
    useSessionStore.getState().setUser(null);
    expect(useSessionStore.getState().deletingAccount).toBe(false);
    expect(selectStatus(useSessionStore.getState())).toBe('signedOut');
  });
});

describe('pending deep-link target', () => {
  const href = { pathname: '/loan/[loanId]', params: { loanId: 'l1' } } as const;

  it('is kept while signed out and through sign-in', () => {
    useSessionStore.getState().setUser(null);
    useSessionStore.getState().setPendingHref(href);
    useSessionStore.getState().setUser(user);
    useSessionStore.getState().setProfile(profile);
    expect(useSessionStore.getState().pendingHref).toEqual(href);
    useSessionStore.getState().setPendingHref(null);
    expect(useSessionStore.getState().pendingHref).toBeNull();
  });

  it('is dropped when the signed-in user signs out', () => {
    useSessionStore.getState().setUser(user);
    useSessionStore.getState().setPendingHref(href);
    useSessionStore.getState().setUser(null);
    expect(useSessionStore.getState().pendingHref).toBeNull();
  });
});

describe('redirect for a blocked signed-in route', () => {
  it('is a plain path, so the blocked route’s params (e.g. ?loanId=) are not carried over', () => {
    expect(appGuardRedirect('ready', true)).toBe('/contacts');
    expect(appGuardRedirect('signedOut', false)).toBe('/phone');
    expect(appGuardRedirect('signedOut', true)).toBe('/phone');
    expect(appGuardRedirect('ready', false)).toBeUndefined();
    expect(appGuardRedirect('needsProfile', false)).toBeUndefined();
  });

  it('keeps the link itself as the pending target until the contacts step is done', () => {
    const href = { pathname: '/loan/[loanId]', params: { loanId: 'l9' } } as const;
    useSessionStore.getState().setUser(user);
    useSessionStore.getState().setProfile(profile);
    useSessionStore.getState().setPendingHref(href);
    expect(appGuardRedirect(selectStatus(useSessionStore.getState()), true)).toBe('/contacts');
    expect(useSessionStore.getState().pendingHref).toEqual(href);
  });
});
