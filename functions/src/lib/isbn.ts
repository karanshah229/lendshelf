/** ISBN helpers. Everything is stored and indexed as ISBN-13. */

export function cleanIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidIsbn10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = s[i] as string;
    const v = c === "X" ? 10 : Number(c);
    sum += v * (10 - i);
  }
  return sum % 11 === 0;
}

export function isbn13CheckDigit(first12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function isValidIsbn13(s: string): boolean {
  if (!/^97[89]\d{10}$/.test(s)) return false;
  return isbn13CheckDigit(s.slice(0, 12)) === s[12];
}

export function isbn10to13(isbn10: string): string {
  const base = `978${isbn10.slice(0, 9)}`;
  return base + isbn13CheckDigit(base);
}

/** Returns a valid ISBN-13 for a valid ISBN-10/13 input, otherwise null. */
export function normaliseIsbn(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const s = cleanIsbn(raw);
  if (s.length === 13) return isValidIsbn13(s) ? s : null;
  if (s.length === 10) return isValidIsbn10(s) ? isbn10to13(s) : null;
  return null;
}
