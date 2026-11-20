/** Languages offered on the confirm step. Codes match what resolveBook returns (ISO 639-1). */
export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'zh', name: 'Chinese' },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l.name]));

/** "en" → "English"; unknown codes are shown as typed. */
export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  return BY_CODE.get(code.toLowerCase()) ?? code;
}

/** Turns what the user typed ("Konkani", "EN") into a stored value (≤ 20 chars) or null. */
export function normaliseLanguageInput(value: string): string | null {
  const v = value.trim().slice(0, 20);
  if (!v) return null;
  const lower = v.toLowerCase();
  const byName = LANGUAGES.find((l) => l.name.toLowerCase() === lower);
  if (byName) return byName.code;
  if (BY_CODE.has(lower)) return lower;
  return v;
}
