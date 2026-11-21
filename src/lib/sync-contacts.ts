/**
 * Contact matching: reads contacts on device, sends only normalised numbers to the
 * `syncContacts` callable, and keeps the names of matched numbers locally.
 */
import { api, type SyncedLink } from '@/lib/api';
import {
  deviceRegion,
  getContactsPermission,
  HAS_ADDRESS_BOOK,
  readDeviceContacts,
} from '@/lib/contacts';
import { errorMessage } from '@/lib/errors';
import { LIMITS } from '@/types/model';
import { newOwnerIdsAfterSync } from '@/features/contacts/resync';
import { useContactsStore } from '@/stores/contacts';
import { useProfilesStore } from '@/stores/profiles';
import { useSessionStore } from '@/stores/session';

export type SyncOutcome =
  | {
      status: 'synced';
      links: SyncedLink[];
      scanned: number;
      truncated: boolean;
      /** People the server's shrink guard kept instead of removing (B1); 0 normally. */
      skippedRemovals: number;
      /** Links that weren't there before this sync ("New on LendShelf"). */
      newLinks: SyncedLink[];
    }
  | { status: 'noPermission' }
  /** No contacts on this device; existing links were left alone. */
  | { status: 'skipped' };

export interface SyncOptions {
  /**
   * Let the server remove more than half of the circle (B1). Only after the user chose
   * "Remove them" on the Sync anyway sheet; never for an automatic sync.
   */
  replace?: boolean;
}

let current: Promise<SyncOutcome> | null = null;

/**
 * Syncs contacts now. Concurrent calls share one run (a `replace` call waits for a running one,
 * then runs). Throws on network/function errors (the error is also stored in
 * `useContactsStore().syncError`).
 */
export function syncContactsNow(opts: SyncOptions = {}): Promise<SyncOutcome> {
  if (opts.replace) {
    const before = current ?? Promise.resolve(null);
    return before.catch(() => null).then(() => start(opts));
  }
  return current ?? start(opts);
}

function start(opts: SyncOptions): Promise<SyncOutcome> {
  const run$ = run(opts).finally(() => {
    if (current === run$) current = null;
  });
  current = run$;
  return run$;
}

async function run({ replace }: SyncOptions): Promise<SyncOutcome> {
  const store = useContactsStore.getState();
  if (HAS_ADDRESS_BOOK) {
    const permission = await getContactsPermission();
    store.setPermission(permission);
    if (permission !== 'granted' && permission !== 'limited') return { status: 'noPermission' };
  }

  store.setSyncing(true);
  try {
    const contacts = await readDeviceContacts(deviceRegion());
    // Nothing to send (e.g. web before any manual contacts were added): don't touch links made
    // on another device.
    if (contacts.length === 0) return { status: 'skipped' };
    const truncated = contacts.length > LIMITS.syncContacts;
    const sent = truncated ? contacts.slice(0, LIMITS.syncContacts) : contacts;
    const before = useSessionStore.getState().links.map((l) => l.ownerId);
    const hadPreviousSync = useContactsStore.getState().lastSyncedAt !== null;
    const { links, skippedRemovals = 0 } = await api.syncContacts({
      phones: sent.map((c) => c.phone),
      ...(replace ? { replace: true } : {}),
    });

    const contactName = new Map(sent.map((c) => [c.phone, c.name]));
    const nameByPhone: Record<string, string> = {};
    for (const link of links) {
      const name = contactName.get(link.ownerPhone);
      if (name && name !== link.ownerPhone) nameByPhone[link.ownerPhone] = name;
    }
    const newOwnerIds = newOwnerIdsAfterSync({
      before,
      after: links.map((l) => l.ownerId),
      hadPreviousSync,
    });
    useContactsStore.getState().setSyncResult({
      nameByPhone,
      linkCount: links.length,
      skippedRemovals,
      newOwnerIds,
    });
    useProfilesStore
      .getState()
      .seedNames(links.flatMap((l) => (l.name ? [{ uid: l.ownerId, name: l.name }] : [])));
    const fresh = new Set(newOwnerIds);
    return {
      status: 'synced',
      links,
      scanned: contacts.length,
      truncated,
      skippedRemovals,
      newLinks: links.filter((l) => fresh.has(l.ownerId)),
    };
  } catch (e) {
    // Visible in `adb logcat -s ReactNativeJS` / Metro; the UI only shows a plain sentence.
    const err = e as { code?: string; message?: string; details?: unknown; userInfo?: unknown };
    console.warn(
      '[syncContacts] failed',
      err?.code,
      err?.message,
      JSON.stringify(err?.details ?? err?.userInfo ?? null)
    );
    useContactsStore.getState().setSyncError(errorMessage(e));
    throw e;
  } finally {
    useContactsStore.getState().setSyncing(false);
  }
}
