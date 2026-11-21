import { useEffect } from 'react';
import { AppState, Linking } from 'react-native';

import { getContactsPermission, HAS_ADDRESS_BOOK } from '@/lib/contacts';
import { syncContactsNow } from '@/lib/sync-contacts';
import { isOnboarded, useContactsStore } from '@/stores/contacts';

import { shouldAutoResync } from './resync';

let wentToSettings = false;

/**
 * "Turn on contacts" / "Open Settings": opens the app's system settings and remembers it, so
 * coming back with permission granted syncs right away (E2a iii → i or ii).
 */
export function openContactsSettings(): void {
  wentToSettings = true;
  void Linking.openSettings();
}

/** True once after `openContactsSettings()`; the screen that handles the return clears it. */
export function consumeSettingsReturn(): boolean {
  const was = wentToSettings;
  wentToSettings = false;
  return was;
}

/**
 * Keeps the contacts permission fresh and re-syncs contacts silently on start and whenever the
 * app comes to the foreground, at most once per 24 h (E13), never with `replace`. Native only:
 * web has no address book. Mount once (SessionBootstrap) for the signed-in user.
 */
export function useContactsAutoResync(uid: string | null | undefined, ready: boolean): void {
  useEffect(() => {
    if (!uid || !ready) return;
    if (!HAS_ADDRESS_BOOK) {
      useContactsStore.getState().setPermission('granted');
      return;
    }
    const check = async (returnedFromSettings: boolean) => {
      const permission = await getContactsPermission().catch(() => null);
      if (!permission) return;
      const store = useContactsStore.getState();
      store.setPermission(permission);
      const now = Date.now();
      if (
        !shouldAutoResync({
          hasAddressBook: HAS_ADDRESS_BOOK,
          permission,
          onboarded: isOnboarded(store.onboarded, uid),
          syncing: store.syncing,
          lastSyncedAt: store.lastSyncedAt,
          lastAutoSyncAt: store.lastAutoSyncAt,
          now,
          returnedFromSettings,
        })
      ) {
        return;
      }
      store.markAutoSyncAttempt(now);
      // Errors are kept in the store (syncError); Home shows "Try again" for them.
      await syncContactsNow().catch(() => {});
    };
    void check(false);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check(consumeSettingsReturn());
    });
    return () => sub.remove();
  }, [uid, ready]);
}
