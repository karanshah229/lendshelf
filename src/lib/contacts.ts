/**
 * Device contacts on Android/iOS (expo-contacts). The web build resolves `contacts.web.ts`,
 * which uses a manually managed list instead. Both export the same surface.
 *
 * The address book is read on device only; just the normalised numbers are sent to
 * `syncContacts`, and nothing beyond the matched names is kept (SPEC §1 Contacts).
 */
import { Contact, ContactField, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import { normalisePhone, toCountryCode, type CountryCode } from '@/lib/phone';

export interface DeviceContact {
  name: string;
  /** E.164 */
  phone: string;
}

/** 'limited' = iOS 18+ "selected contacts only". */
export type ContactsPermission = 'granted' | 'limited' | 'denied' | 'undetermined';

/** True where an address book exists (native). False on web, which uses a manual list. */
export const HAS_ADDRESS_BOOK = true;

/** Region used to read numbers without a country code (device region, default IN). */
export function deviceRegion(): CountryCode {
  return toCountryCode(getLocales()[0]?.regionCode);
}

function toPermission(res: {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
  accessPrivileges?: 'all' | 'limited' | 'none';
}): ContactsPermission {
  if (res.granted) return res.accessPrivileges === 'limited' ? 'limited' : 'granted';
  if (res.status === 'undetermined' || res.canAskAgain) return 'undetermined';
  return 'denied';
}

export async function getContactsPermission(): Promise<ContactsPermission> {
  return toPermission(await getPermissionsAsync());
}

export async function requestContactsPermission(): Promise<ContactsPermission> {
  return toPermission(await requestPermissionsAsync());
}

/**
 * iOS 18+ with limited access: lets the user add more contacts to what the app can see.
 * Returns false when not applicable.
 */
export async function presentLimitedAccessPicker(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    await Contact.presentAccessPicker();
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads every contact phone number, normalised to E.164 and de-duplicated by number
 * (the first name seen wins). Invalid numbers are skipped.
 */
export async function readDeviceContacts(
  region: CountryCode = deviceRegion()
): Promise<DeviceContact[]> {
  const all = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES] as const);
  const byPhone = new Map<string, DeviceContact>();
  for (const c of all) {
    const name = c.fullName?.trim() ?? '';
    for (const p of c.phones ?? []) {
      const e164 = p.number ? normalisePhone(p.number, region) : null;
      if (e164 && !byPhone.has(e164)) byPhone.set(e164, { name: name || e164, phone: e164 });
    }
  }
  return [...byPhone.values()].sort((a, b) => a.name.localeCompare(b.name));
}
