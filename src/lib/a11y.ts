/**
 * Screen-reader helpers (UX §F8). Pure string builders, plus `announce()` for state changes.
 *
 *   cardLabel({ title: 'Asha Rao wants Sapiens', context: 'expires in 2 days', actions: ['Accept', 'Decline'] })
 *   // → "Asha Rao wants Sapiens. Expires in 2 days. Accept or decline."
 *   announce('Request sent');
 */
import { AccessibilityInfo, Platform } from 'react-native';

/** "A", "A or B", "A, B or C". */
export function orList(items: readonly string[]): string {
  const list = items.map((s) => s.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

/** Lower-cases the first letter, except for "I" and "I've"-style words. */
function lowerFirst(s: string): string {
  if (/^I(\b|[’'])/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Upper-cases the first letter. */
function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Joins label parts into sentences: skips empty parts, capitalises each, and ends each with one
 * full stop (keeps an existing "?", "!" or "…").
 */
export function sentences(parts: readonly (string | null | undefined | false)[]): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .map((p) => {
      const s = upperFirst(p);
      return /[.?!…]$/.test(s) ? s : `${s}.`;
    })
    .join(' ');
}

/**
 * One label for a card that is a single tap target with its own buttons: what it is, its status
 * in words, then the actions in visual order ("Accept or decline").
 */
export function cardLabel({
  title,
  context,
  note,
  actions = [],
}: {
  title: string;
  context?: string | null;
  note?: string | null;
  actions?: readonly string[];
}): string {
  const acts = actions.map((a, i) => (i === 0 ? a : lowerFirst(a)));
  return sentences([title, context, note, orList(acts)]);
}

/** Shortens visible text to `max` characters with an ellipsis (the full text goes in the label). */
export function clipText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/**
 * Tells the screen reader about a state change (request sent, card resolved, loan closed).
 * A no-op on web, where react-native-web doesn't implement it.
 */
export function announce(message: string): void {
  if (!message.trim() || Platform.OS === 'web') return;
  AccessibilityInfo.announceForAccessibility(message);
}
