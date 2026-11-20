/**
 * Edition details (format, language) as shown and edited on the copy page.
 * Languages are stored as short codes (resolveBook returns e.g. "en").
 */
import type { ItemFormat } from '@/types/model';

export const FORMAT_OPTIONS: { value: ItemFormat; label: string }[] = [
  { value: 'paperback', label: 'Paperback' },
  { value: 'hardcover', label: 'Hardcover' },
  { value: 'other', label: 'Other' },
];

export function formatLabel(format: ItemFormat | null | undefined): string | null {
  return FORMAT_OPTIONS.find((f) => f.value === format)?.label ?? null;
}

/** Common languages for the picker (India first, then widely read ones). */
export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'mr', label: 'Marathi' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'ur', label: 'Urdu' },
  { value: 'sa', label: 'Sanskrit' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ar', label: 'Arabic' },
];

/** Open Library sometimes uses 3-letter MARC codes ("eng"). */
const THREE_LETTER: Record<string, string> = {
  eng: 'en',
  hin: 'hi',
  ben: 'bn',
  guj: 'gu',
  kan: 'kn',
  mal: 'ml',
  mar: 'mr',
  pan: 'pa',
  tam: 'ta',
  tel: 'te',
  urd: 'ur',
  san: 'sa',
  fre: 'fr',
  fra: 'fr',
  ger: 'de',
  deu: 'de',
  spa: 'es',
  ita: 'it',
  por: 'pt',
  rus: 'ru',
  jpn: 'ja',
  chi: 'zh',
  zho: 'zh',
  ara: 'ar',
};

/** "en" / "eng" / "English" → "English"; unknown codes are shown upper-cased. */
export function languageName(code: string | null | undefined): string | null {
  const raw = code?.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const normalised = THREE_LETTER[lower] ?? lower;
  const known = LANGUAGE_OPTIONS.find(
    (l) => l.value === normalised || l.label.toLowerCase() === lower
  );
  if (known) return known.label;
  return raw.length <= 3 ? raw.toUpperCase() : raw;
}

/** "Paperback · English" (null when nothing is known). */
export function editionSummary(item: {
  format: ItemFormat | null;
  language: string | null;
}): string | null {
  const parts = [formatLabel(item.format), languageName(item.language)].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
