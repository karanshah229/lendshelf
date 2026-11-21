/** Small helpers for showing people. */

/** Titles and kinship words that never stand alone as a name ("Dr.", "Mrs", "Aunty"). */
const TITLES = new Set([
  'dr', 'mr', 'mrs', 'ms', 'miss', 'mx', 'prof', 'sir', 'madam', 'shri', 'sri', 'smt', 'kum',
  'capt', 'col', 'maj', 'gen', 'lt', 'rev', 'fr', 'adv', 'er', 'uncle', 'aunty', 'auntie',
  'aunt', 'bhaiya', 'didi',
]);

/** A word that can't be shown on its own: a title, an initial ("A."), or any abbreviation ending in ".". */
function isTitleOrAbbreviation(word: string): boolean {
  const bare = word.replace(/[.,]+$/, '').toLowerCase();
  if (!bare) return true;
  if (TITLES.has(bare)) return true;
  if (word.endsWith('.')) return true;
  return Array.from(bare).length === 1;
}

/** Words of a name, without bracketed notes and stray punctuation: "Nikhil (neighbour)" → ["Nikhil"]. */
function nameWords(name: string): string[] {
  return name
    .replace(/\([^)]*\)?|\[[^\]]*\]?/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));
}

/**
 * The short form of a person's name for UI labels ("Message Ravi", "Waiting for Ravi to
 * pick up"). Normally the first word of the name ("Ravi Menon" → "Ravi"), but a name
 * that starts with a title or an initial is kept whole, so a short form never ends on
 * one: "Dr. Mehta" stays "Dr. Mehta", "Mrs. A. Iyer" stays "Mrs. A. Iyer". Bracketed
 * notes are dropped ("Nikhil (neighbour)" → "Nikhil").
 */
export function shortName(name: string | null | undefined): string {
  const raw = (name ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  // A phone number shown in place of a name ("+91 90000 00002") is never shortened.
  if (!/\p{L}/u.test(raw)) return raw;
  const words = nameWords(raw);
  if (!words.length) return raw;
  if (words.length === 1 || !isTitleOrAbbreviation(words[0]!)) return words[0]!;
  // Starts with a title or initial: keep the name whole (without bracketed notes).
  return words.join(' ');
}

/** "Asha Rao" → "AR", "kabir" → "K", "Nikhil (neighbour)" → "N", "Dr. Mehta" → "M", "" → "?". */
export function initials(name: string | null | undefined): string {
  const words = nameWords(name ?? '');
  const named = words.filter((w) => !TITLES.has(w.replace(/[.,]+$/, '').toLowerCase()));
  const parts = named.length ? named : words;
  if (!parts.length) return '?';
  const letter = (w: string) => Array.from(w).find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? '';
  const first = letter(parts[0]!);
  const last = parts.length > 1 ? letter(parts.at(-1)!) : '';
  return (first + last).toUpperCase() || '?';
}

/** "back 12 Dec" → "Back 12 Dec". */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** "Asha, Ravi and 2 others" style list of names. */
export function joinNames(names: readonly string[], max = 3): string {
  const unique = [...new Set(names)];
  if (unique.length <= 1) return unique[0] ?? '';
  if (unique.length <= max) return `${unique.slice(0, -1).join(', ')} and ${unique.at(-1)}`;
  const rest = unique.length - (max - 1);
  return `${unique.slice(0, max - 1).join(', ')} and ${rest} others`;
}
