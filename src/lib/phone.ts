import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export type { CountryCode };

export const DEFAULT_REGION: CountryCode = 'IN';

const E164_RE = /^\+[1-9]\d{6,14}$/;

/** True if `value` is already an E.164 number such as `+919876543210`. */
export function isE164(value: string): boolean {
  return E164_RE.test(value);
}

/**
 * Normalises a phone number typed by a user or read from the address book to E.164.
 * Numbers without a country code are read in `region` (the device region, default IN).
 * Handles spaces, dashes, brackets, a `00` international prefix and national trunk prefixes.
 * Returns `null` when the number isn't a valid phone number.
 */
export function normalisePhone(raw: string, region: CountryCode = DEFAULT_REGION): string | null {
  if (!raw) return null;
  let cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  // "00" international prefix → "+"
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`;
  // Stray "+" signs anywhere but the start are noise.
  cleaned = cleaned[0] + cleaned.slice(1).replace(/\+/g, '');

  const parsed = parsePhoneNumberFromString(cleaned, region);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/** Normalises many numbers, dropping invalid ones and duplicates (order preserved). */
export function normalisePhones(
  raws: Iterable<string>,
  region: CountryCode = DEFAULT_REGION
): string[] {
  const seen = new Set<string>();
  for (const raw of raws) {
    const e164 = normalisePhone(raw, region);
    if (e164) seen.add(e164);
  }
  return [...seen];
}

/** Formats an E.164 number for display, e.g. `+91 98765 43210`. Falls back to the input. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Digits only, as used by wa.me links (`+919876543210` → `919876543210`). */
export function phoneDigits(e164: string): string {
  return e164.replace(/\D/g, '');
}

/** Calling code for a region, e.g. `IN` → `+91`. */
export function dialCode(region: CountryCode): string {
  return `+${getCountryCallingCode(region)}`;
}

/**
 * Reads a region code from a locale region (e.g. expo-localization's `regionCode`),
 * falling back to IN when it's missing or unknown to libphonenumber.
 */
export function toCountryCode(regionCode: string | null | undefined): CountryCode {
  if (!regionCode) return DEFAULT_REGION;
  const upper = regionCode.toUpperCase();
  try {
    getCountryCallingCode(upper as CountryCode);
    return upper as CountryCode;
  } catch {
    return DEFAULT_REGION;
  }
}
