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

/** The name as saved, with spaces tidied ("  Asha   Rao " → "Asha Rao"). */
function tidy(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/\s+/g, ' ');
}

/** First word, or the whole name when it starts with a title or initial (see `shortName`). */
function firstWordName(raw: string): string {
  if (!raw) return '';
  // A phone number shown in place of a name ("+91 90000 00002") is never shortened.
  if (!/\p{L}/u.test(raw)) return raw;
  const words = nameWords(raw);
  if (!words.length) return raw;
  if (words.length === 1 || !isTitleOrAbbreviation(words[0]!)) return words[0]!;
  // Starts with a title or initial: keep the name whole (without bracketed notes).
  return words.join(' ');
}

/**
 * Display names of everyone in the user's circle (people I saved who are on LendShelf).
 * `src/hooks/use-links.ts` registers a source that reads the live stores, so `shortName` always
 * sees the same circle as the screen being rendered. It checks against them so that two people
 * never share a short name ("LendShelf Test Ravi" and "LendShelf Test Meera" are not both
 * "LendShelf"). Empty until registered (e.g. in unit tests).
 */
let circleNamesSource: () => readonly string[] = () => [];

export function setCircleNamesSource(source: () => readonly string[]): void {
  circleNamesSource = source;
}

/**
 * The short form of a person's name for UI labels ("Message Ravi", "Waiting for Ravi to
 * pick up"). Normally the first word of the name ("Ravi Menon" → "Ravi"), but a name
 * that starts with a title or an initial is kept whole, so a short form never ends on
 * one: "Dr. Mehta" stays "Dr. Mehta", "Mrs. A. Iyer" stays "Mrs. A. Iyer". Bracketed
 * notes are dropped ("Nikhil (neighbour)" → "Nikhil").
 *
 * When another person in view (`among`, by default the user's circle) has a different name
 * with the same short form, the full saved name is used instead, so two people never look
 * like one: "LendShelf Test Ravi" and "LendShelf Test Meera" stay whole.
 */
export function shortName(
  name: string | null | undefined,
  among: readonly string[] = circleNamesSource()
): string {
  const raw = tidy(name);
  const short = firstWordName(raw);
  if (!short || short === raw) return short;
  const key = short.toLocaleLowerCase();
  const clash = among.some((other) => {
    const o = tidy(other);
    return o !== raw && firstWordName(o).toLocaleLowerCase() === key;
  });
  return clash ? raw : short;
}

/**
 * Short names for several people shown together (one entry per person, same order): each is
 * kept apart from the others in the list as well as from the circle.
 */
export function shortNames(names: readonly (string | null | undefined)[]): string[] {
  const among = [...circleNamesSource(), ...names.map(tidy).filter(Boolean)];
  return names.map((n) => shortName(n, among));
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

/**
 * "Asha, Ravi and 2 others" style list of names, one entry per person. Equal names are not
 * merged (two friends can share a name): callers de-duplicate people by uid.
 */
export function joinNames(names: readonly string[], max = 3): string {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? '';
  if (list.length <= max) return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
  const rest = list.length - (max - 1);
  return `${list.slice(0, max - 1).join(', ')} and ${rest} others`;
}
