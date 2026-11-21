import { selectStatus, useSessionStore } from '@/stores/session';
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
