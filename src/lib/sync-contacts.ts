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
import { useContactsStore } from '@/stores/contacts';
import { useProfilesStore } from '@/stores/profiles';

export type SyncOutcome =
  | { status: 'synced'; links: SyncedLink[]; scanned: number; truncated: boolean }
  | { status: 'noPermission' }
  /** No contacts on this device; existing links were left alone. */
  | { status: 'skipped' };

let current: Promise<SyncOutcome> | null = null;

/**
 * Syncs contacts now. Concurrent calls share one run. Throws on network/function errors
 * (the error is also stored in `useContactsStore().syncError`).
 */
export function syncContactsNow(): Promise<SyncOutcome> {
  current ??= run().finally(() => {
    current = null;
  });
  return current;
}

async function run(): Promise<SyncOutcome> {
  const store = useContactsStore.getState();
  if (HAS_ADDRESS_BOOK) {
    const permission = await getContactsPermission();
    if (permission !== 'granted' && permission !== 'limited') return { status: 'noPermission' };
  }

  store.setSyncing(true);
  try {
    const contacts = await readDeviceContacts(deviceRegion());
    // syncContacts replaces all links; with nothing to send (e.g. web before any manual
    // contacts were added) don't wipe links made on another device.
    if (contacts.length === 0) return { status: 'skipped' };
    const truncated = contacts.length > LIMITS.syncContacts;
    const sent = truncated ? contacts.slice(0, LIMITS.syncContacts) : contacts;
    const { links } = await api.syncContacts({ phones: sent.map((c) => c.phone) });

    const contactName = new Map(sent.map((c) => [c.phone, c.name]));
    const nameByPhone: Record<string, string> = {};
    for (const link of links) {
      const name = contactName.get(link.ownerPhone);
      if (name && name !== link.ownerPhone) nameByPhone[link.ownerPhone] = name;
    }
    useContactsStore.getState().setSyncResult({ nameByPhone, linkCount: links.length });
    useProfilesStore
      .getState()
      .seedNames(links.flatMap((l) => (l.name ? [{ uid: l.ownerId, name: l.name }] : [])));
    return { status: 'synced', links, scanned: contacts.length, truncated };
  } catch (e) {
    useContactsStore.getState().setSyncError(errorMessage(e));
    throw e;
  } finally {
    useContactsStore.getState().setSyncing(false);
  }
}
