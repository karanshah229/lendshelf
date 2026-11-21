/** Sign-out and account deletion with the client-side cleanup they need. */
import { api } from '@/lib/api';
import { signOut } from '@/lib/firebase';
import { forgetPushRegistration, unregisterPush } from '@/lib/push';
import { useSessionStore } from '@/stores/session';

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

/** Removes this device's push token (best effort, while still signed in), then signs out. */
export async function signOutAndCleanUp(): Promise<void> {
  const uid = useSessionStore.getState().user?.uid;
  if (uid) await withTimeout(unregisterPush(uid), 4000);
  await signOut();
}

/**
 * Deletes the account on the server (all data, then the Auth user) and signs out locally.
 * The users doc (and its push tokens) is gone with the account.
 */
export async function deleteAccountAndSignOut(): Promise<void> {
  const session = useSessionStore.getState();
  session.setDeletingAccount(true);
  try {
    await api.deleteAccount({});
  } catch (e) {
    session.setDeletingAccount(false);
    throw e;
  }
  forgetPushRegistration();
  try {
    await signOut();
  } catch {
    // The Auth user no longer exists; the local session is cleared either way.
  }
}
