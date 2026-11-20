/** Small helpers for showing people. */

/** "Asha Rao" → "AR", "kabir" → "K", "" → "?". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = Array.from(parts[0]!)[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts.at(-1)!)[0] ?? '') : '';
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
