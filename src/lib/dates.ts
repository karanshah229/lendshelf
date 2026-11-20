/**
 * Date helpers for due dates and loan labels. All calculations use local calendar days.
 * Labels are English and deterministic (no Intl), e.g. "back 12 Dec", "overdue 3 days".
 */
import type { TimestampLike } from '@/types/model';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateInput = Date | TimestampLike | number;

export function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return value.toDate();
}

/** Midnight (local) of the given day. */
export function startOfDay(value: DateInput): Date {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(value: DateInput, days: number): Date {
  const d = toDate(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes());
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). DST-safe. */
export function calendarDaysBetween(from: DateInput, to: DateInput): number {
  const a = startOfDay(from);
  const b = startOfDay(to);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / DAY_MS);
}

/** "12 Dec", or "12 Dec 2027" when not in the current year. */
export function formatShortDate(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "12 Dec 2026" always with the year (exports, details). */
export function formatLongDate(value: DateInput): string {
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Local date as `YYYY-MM-DD`. */
export function toISODate(value: DateInput): string {
  const d = toDate(value);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export type DueState =
  | { kind: 'overdue'; days: number }
  | { kind: 'today' }
  | { kind: 'soon'; days: number }
  | { kind: 'later'; days: number };

/** How a due date relates to today. "soon" means within `soonDays` (default 2). */
export function dueState(due: DateInput, now: Date = new Date(), soonDays = 2): DueState {
  const days = calendarDaysBetween(now, due);
  if (days < 0) return { kind: 'overdue', days: -days };
  if (days === 0) return { kind: 'today' };
  if (days <= soonDays) return { kind: 'soon', days };
  return { kind: 'later', days };
}

/** Status label for a lent copy: "back 12 Dec", "back today", or "overdue 3 days". */
export function backLabel(due: DateInput | null | undefined, now: Date = new Date()): string {
  if (!due) return 'lent out';
  const state = dueState(due, now);
  if (state.kind === 'overdue') return `overdue ${plural(state.days, 'day')}`;
  if (state.kind === 'today') return 'back today';
  return `back ${formatShortDate(due, now)}`;
}

/** Label for the borrower/owner loan list: "due 12 Dec", "due today", "due tomorrow", "overdue 1 day". */
export function dueLabel(due: DateInput | null | undefined, now: Date = new Date()): string {
  if (!due) return 'no due date';
  const state = dueState(due, now);
  if (state.kind === 'overdue') return `overdue ${plural(state.days, 'day')}`;
  if (state.kind === 'today') return 'due today';
  if (state.days === 1) return 'due tomorrow';
  return `due ${formatShortDate(due, now)}`;
}

export function isOverdue(due: DateInput | null | undefined, now: Date = new Date()): boolean {
  return !!due && dueState(due, now).kind === 'overdue';
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", else a short date. */
export function timeAgo(value: DateInput, now: Date = new Date()): string {
  const d = toDate(value);
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  const days = calendarDaysBetween(d, now);
  if (days === 0) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatShortDate(d, now);
}
