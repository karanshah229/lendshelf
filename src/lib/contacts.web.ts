/**
 * Web has no address book. Contacts are a manually managed list (persisted in the contacts
 * store via AsyncStorage) that the Contacts screen edits; see `useContactsStore`.
 * Same surface as `contacts.ts`.
 */
import { useContactsStore } from '@/stores/contacts';
import { DEFAULT_REGION, toCountryCode, type CountryCode } from '@/lib/phone';

export interface DeviceContact {
  name: string;
  /** E.164 */
  phone: string;
}

export type ContactsPermission = 'granted' | 'limited' | 'denied' | 'undetermined';

export const HAS_ADDRESS_BOOK = false;

export function deviceRegion(): CountryCode {
  if (typeof navigator === 'undefined') return DEFAULT_REGION;
  const match = /-([A-Za-z]{2})$/.exec(navigator.language ?? '');
  return toCountryCode(match?.[1]);
}

/** The manual list needs no permission. */
export async function getContactsPermission(): Promise<ContactsPermission> {
  return 'granted';
}

export async function requestContactsPermission(): Promise<ContactsPermission> {
  return 'granted';
}

export async function presentLimitedAccessPicker(): Promise<boolean> {
  return false;
}

export async function readDeviceContacts(_region?: CountryCode): Promise<DeviceContact[]> {
  return [...useContactsStore.getState().manualContacts].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}
