import { useCallback, useEffect, useState } from 'react';

import {
  getContactsPermission,
  readDeviceContacts,
  requestContactsPermission,
  type ContactsPermission,
  type DeviceContact,
} from '@/lib/contacts';

export type DeviceContactsStatus = 'loading' | 'needsPermission' | 'denied' | 'ready' | 'error';

/**
 * Phone contacts for picking a borrower, read on device only and kept in memory while the
 * screen is open (web: the manually entered list).
 */
export function useDeviceContacts() {
  const [status, setStatus] = useState<DeviceContactsStatus>('loading');
  const [contacts, setContacts] = useState<DeviceContact[]>([]);

  const load = useCallback(async (permission: ContactsPermission) => {
    if (permission === 'undetermined') return setStatus('needsPermission');
    if (permission === 'denied') return setStatus('denied');
    setStatus('loading');
    try {
      setContacts(await readDeviceContacts());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getContactsPermission().then((p) => {
      if (!cancelled) void load(p);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const request = useCallback(async () => {
    await load(await requestContactsPermission());
  }, [load]);

  return { status, contacts, request };
}
