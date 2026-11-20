/**
 * Phone number helpers. The app normalises numbers to E.164 on the device
 * (libphonenumber-js, default region IN); the backend re-validates and
 * accepts a few common local spellings so a typed number still matches.
 */

const E164 = /^\+[1-9]\d{6,14}$/;

export function isE164(value: string): boolean {
  return E164.test(value);
}

/**
 * Normalise a phone number to E.164, or return null if it can't be.
 *
 * - strips spaces, dashes, dots and brackets
 * - `00` international prefix -> `+`
 * - a bare national number (10 digits, or 11 starting with 0) gets the
 *   default calling code (India, `91`)
 * - a 12-digit number starting with the default calling code gets a `+`
 */
export function normalisePhone(raw: string, defaultCallingCode = "91"): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/[\s\-(). ]/g, "");
  if (s === "") return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!s.startsWith("+")) {
    if (!/^\d+$/.test(s)) return null;
    if (s.length === 11 && s.startsWith("0")) s = s.slice(1);
    if (s.length === 10) s = `+${defaultCallingCode}${s}`;
    else if (s.length === 10 + defaultCallingCode.length && s.startsWith(defaultCallingCode)) s = `+${s}`;
    else return null;
  }
  return isE164(s) ? s : null;
}

/** Digits for a WhatsApp deep link (`https://wa.me/<digits>`). */
export function waDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}
