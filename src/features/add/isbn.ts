/**
 * ISBN helpers for the Add flow. Mirrors `functions/src/lib/isbn.ts`: everything is
 * normalised to ISBN-13 so a scan and a typed ISBN of the same edition match.
 */

/** Strips spaces and hyphens and upper-cases a trailing "x". */
export function cleanIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = s[i] as string;
    sum += (c === 'X' ? 10 : Number(c)) * (10 - i);
  }
  return sum % 11 === 0;
}

export function isbn13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

/** A valid ISBN-13 is an EAN-13 in the "Bookland" 978/979 range with a correct check digit. */
export function isValidIsbn13(s: string): boolean {
  if (!/^97[89]\d{10}$/.test(s)) return false;
  return isbn13CheckDigit(s.slice(0, 12)) === s[12];
}

export function isbn10to13(isbn10: string): string {
  const base = `978${isbn10.slice(0, 9)}`;
  return base + isbn13CheckDigit(base);
}

/** A valid ISBN-13 for a valid ISBN-10/13 (hyphens and spaces allowed), otherwise null. */
export function normaliseIsbn(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const s = cleanIsbn(raw);
  if (s.length === 13) return isValidIsbn13(s) ? s : null;
  if (s.length === 10) return isValidIsbn10(s) ? isbn10to13(s) : null;
  return null;
}

/**
 * Reads a scanned barcode. Book barcodes are EAN-13 in the 978/979 range; EAN-8 and other
 * EAN-13s (prices, groceries) are not ISBNs.
 */
export type BarcodeRead = { kind: 'isbn'; isbn: string } | { kind: 'notIsbn' };

export function readBarcode(data: string | null | undefined): BarcodeRead {
  const isbn = normaliseIsbn((data ?? '').replace(/\D/g, ''));
  return isbn ? { kind: 'isbn', isbn } : { kind: 'notIsbn' };
}

/** True when a search box value looks like someone typed an ISBN rather than a title. */
export function looksLikeIsbn(value: string): boolean {
  const s = cleanIsbn(value.trim());
  return /^\d{9}[\dX]$/.test(s) || /^\d{13}$/.test(s);
}

/**
 * Readable ISBN-13 for display: "978 0141 439518". (Real hyphenation depends on publisher
 * ranges; this simple grouping is only for legibility.)
 */
export function formatIsbn(isbn13: string): string {
  if (isbn13.length !== 13) return isbn13;
  return `${isbn13.slice(0, 3)} ${isbn13.slice(3, 7)} ${isbn13.slice(7)}`;
}
