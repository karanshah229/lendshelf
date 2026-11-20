/**
 * Contacts state: the phone → name map used to show owners by the name *you* saved them as,
 * sync status, and (web only) the manually managed contact list.
 *
 * Only names of matched numbers (people on LendShelf) are kept; the rest of the
 * address book is never stored.
 */
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DeviceContact } from '@/lib/contacts';
import { persistStorage } from '@/stores/storage';

export interface ContactsState {
  /** E.164 → name saved in the device contacts, for matched numbers only. */
  nameByPhone: Record<string, string>;
  /** Number of people matched by the last sync. */
  linkCount: number;
  lastSyncedAt: number | null;
  syncing: boolean;
  syncError: string | null;
  /** uid → true once that user finished or skipped the Contacts onboarding step on this device. */
  onboarded: Record<string, true>;
  /** Web only: manual contacts per signed-in uid (web has no address book). */
  manualByUid: Record<string, DeviceContact[]>;
  /** Web only: the list for the current user (mirrors manualByUid[currentUid]). */
  manualContacts: DeviceContact[];
  currentUid: string | null;

  setCurrentUid(uid: string | null): void;
  setSyncing(syncing: boolean): void;
  setSyncResult(result: { nameByPhone: Record<string, string>; linkCount: number }): void;
  setSyncError(message: string | null): void;
  markOnboarded(uid: string): void;
  addManualContacts(contacts: DeviceContact[]): void;
  removeManualContact(phone: string): void;
  /** Clears per-user state on sign-out. */
  reset(): void;
}

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      nameByPhone: {},
      linkCount: 0,
      lastSyncedAt: null,
      syncing: false,
      syncError: null,
      onboarded: {},
      manualByUid: {},
      manualContacts: [],
      currentUid: null,

      setCurrentUid(uid) {
        set({ currentUid: uid, manualContacts: uid ? (get().manualByUid[uid] ?? []) : [] });
      },
      setSyncing(syncing) {
        set({ syncing });
      },
      setSyncResult({ nameByPhone, linkCount }) {
        set({ nameByPhone, linkCount, lastSyncedAt: Date.now(), syncError: null });
      },
      setSyncError(syncError) {
        set({ syncError });
      },
      markOnboarded(uid) {
        set({ onboarded: { ...get().onboarded, [uid]: true } });
      },
      addManualContacts(contacts) {
        const uid = get().currentUid;
        if (!uid) return;
        const byPhone = new Map(get().manualContacts.map((c) => [c.phone, c]));
        for (const c of contacts) byPhone.set(c.phone, c);
        const list = [...byPhone.values()];
        set({ manualContacts: list, manualByUid: { ...get().manualByUid, [uid]: list } });
      },
      removeManualContact(phone) {
        const uid = get().currentUid;
        if (!uid) return;
        const list = get().manualContacts.filter((c) => c.phone !== phone);
        set({ manualContacts: list, manualByUid: { ...get().manualByUid, [uid]: list } });
      },
      reset() {
        set({
          nameByPhone: {},
          linkCount: 0,
          lastSyncedAt: null,
          syncing: false,
          syncError: null,
          currentUid: null,
          manualContacts: [],
        });
      },
    }),
    {
      name: 'lendshelf.contacts',
      version: 1,
      storage: persistStorage,
      // manualContacts isn't persisted; rebuild it for the current user once storage is loaded.
      onRehydrateStorage: () => (state) => state?.setCurrentUid(state.currentUid),
      partialize: (s) => ({
        nameByPhone: s.nameByPhone,
        linkCount: s.linkCount,
        lastSyncedAt: s.lastSyncedAt,
        onboarded: s.onboarded,
        manualByUid: s.manualByUid,
      }),
    }
  )
);

/** True once the persisted contacts state has loaded (the auth gate waits for it). */
export function useContactsHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useContactsStore.persist.onFinishHydration(onChange),
    () => useContactsStore.persist.hasHydrated(),
    () => false
  );
}
