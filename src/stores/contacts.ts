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

import type { ContactsPermission, DeviceContact } from '@/lib/contacts';
import { persistStorage, rehydrateOnOtherTabWrites, writeOnlyAfterLoad } from '@/stores/storage';

export interface ContactsState {
  /** E.164 → name saved in the device contacts, for matched numbers only. */
  nameByPhone: Record<string, string>;
  /** Number of people matched by the last sync. */
  linkCount: number;
  lastSyncedAt: number | null;
  /** People the last sync's shrink guard kept instead of removing (UX §E13); 0 normally. */
  skippedRemovals: number;
  /** Owners that joined the circle in the latest sync, for the "New on LendShelf" chip. */
  newOwnerIds: string[];
  /** Last automatic re-sync attempt (success or not): at most one per 24 h (E13). */
  lastAutoSyncAt: number | null;
  /** Address-book permission as last checked (web: always 'granted'); null until checked. */
  permission: ContactsPermission | null;
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
  setSyncResult(result: {
    nameByPhone: Record<string, string>;
    linkCount: number;
    skippedRemovals?: number;
    newOwnerIds?: string[];
  }): void;
  setSyncError(message: string | null): void;
  setPermission(permission: ContactsPermission): void;
  markAutoSyncAttempt(at: number): void;
  markOnboarded(uid: string): void;
  addManualContacts(contacts: DeviceContact[]): void;
  removeManualContact(phone: string): void;
  /** Clears per-user state on sign-out (the per-uid onboarding flags stay: they're per device). */
  reset(): void;
}

/** What is written to storage. */
export type PersistedContacts = Pick<
  ContactsState,
  | 'nameByPhone'
  | 'linkCount'
  | 'lastSyncedAt'
  | 'skippedRemovals'
  | 'newOwnerIds'
  | 'lastAutoSyncAt'
  | 'onboarded'
  | 'manualByUid'
>;

export const CONTACTS_STORAGE_KEY = 'lendshelf.contacts';

export function partializeContacts(s: ContactsState): PersistedContacts {
  return {
    nameByPhone: s.nameByPhone,
    linkCount: s.linkCount,
    lastSyncedAt: s.lastSyncedAt,
    skippedRemovals: s.skippedRemovals,
    newOwnerIds: s.newOwnerIds,
    lastAutoSyncAt: s.lastAutoSyncAt,
    onboarded: s.onboarded,
    manualByUid: s.manualByUid,
  };
}

/**
 * Merges stored state into the in-memory state (on start, and on web whenever another tab
 * writes). Stored values win, except the onboarding flags, which are the union of both: a flag
 * is only ever added, so one copy missing it means that copy is stale, never that it was
 * removed. This is what keeps "Find your people" from coming back for someone who finished it.
 * Also rebuilds `manualContacts` for the current user (it isn't stored).
 */
export function mergeContactsState<S extends ContactsState>(persisted: unknown, current: S): S {
  const stored = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<
    PersistedContacts
  >;
  const merged: S = { ...current, ...stored };
  merged.onboarded = { ...(stored.onboarded ?? {}), ...current.onboarded };
  merged.manualByUid = stored.manualByUid ?? current.manualByUid;
  merged.newOwnerIds = stored.newOwnerIds ?? current.newOwnerIds;
  merged.manualContacts = current.currentUid
    ? (merged.manualByUid[current.currentUid] ?? [])
    : [];
  return merged;
}

/** Has this user finished or skipped the contacts step on this device? */
export function isOnboarded(
  onboarded: Readonly<Record<string, true>>,
  uid: string | null | undefined
): boolean {
  return !!uid && onboarded[uid] === true;
}

/** Set once the first read of the saved state has finished (writes wait for it). */
let loaded = false;

const SIGNED_OUT: Partial<ContactsState> = {
  nameByPhone: {},
  linkCount: 0,
  lastSyncedAt: null,
  skippedRemovals: 0,
  newOwnerIds: [],
  lastAutoSyncAt: null,
  syncing: false,
  syncError: null,
  currentUid: null,
  manualContacts: [],
};

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      nameByPhone: {},
      linkCount: 0,
      lastSyncedAt: null,
      skippedRemovals: 0,
      newOwnerIds: [],
      lastAutoSyncAt: null,
      permission: null,
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
      setSyncResult({ nameByPhone, linkCount, skippedRemovals = 0, newOwnerIds = [] }) {
        set({
          nameByPhone,
          linkCount,
          skippedRemovals,
          newOwnerIds,
          lastSyncedAt: Date.now(),
          syncError: null,
        });
      },
      setSyncError(syncError) {
        set({ syncError });
      },
      setPermission(permission) {
        if (get().permission !== permission) set({ permission });
      },
      markAutoSyncAttempt(at) {
        set({ lastAutoSyncAt: at });
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
        set(SIGNED_OUT);
      },
    }),
    {
      name: CONTACTS_STORAGE_KEY,
      version: 1,
      // Nothing is written before the saved state was read: an early `set` (the auth listener
      // can fire first on a phone) would otherwise save the empty defaults over it.
      storage: writeOnlyAfterLoad(persistStorage, () => loaded),
      partialize: partializeContacts,
      merge: mergeContactsState,
      onRehydrateStorage: () => () => {
        loaded = true;
      },
    }
  )
);

rehydrateOnOtherTabWrites(CONTACTS_STORAGE_KEY, () => useContactsStore.persist.rehydrate());

// Once loaded, the store stays "hydrated" for the auth gate: a later re-read (another tab wrote)
// briefly resets zustand's flag, and the gate must not flash the loading screen for it.
let everHydrated = false;
const subscribeHydration = (onChange: () => void) =>
  useContactsStore.persist.onFinishHydration(() => {
    everHydrated = true;
    onChange();
  });
const hydratedSnapshot = () => {
  if (useContactsStore.persist.hasHydrated()) everHydrated = true;
  return everHydrated;
};

/** True once the persisted contacts state has loaded (the auth gate waits for it). */
export function useContactsHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, hydratedSnapshot, () => false);
}
