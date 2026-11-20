/**
 * Due dates for lending: quick presets, limits (today … +1 year, as the backend enforces)
 * and the month grid for the calendar picker. All local calendar days.
 */
import { addDays, calendarDaysBetween, startOfDay } from '@/lib/dates';
import { DEFAULT_LOAN_DAYS } from '@/types/model';

export interface DuePreset {
  id: '1w' | '2w' | '3w' | '1m';
  label: string;
}

export const DUE_PRESETS: readonly DuePreset[] = [
  { id: '1w', label: '1 week' },
  { id: '2w', label: '2 weeks' },
  { id: '3w', label: '3 weeks' },
  { id: '1m', label: '1 month' },
];

/** Same day next month, clamped to the month's last day (31 Jan → 28/29 Feb). */
export function addMonthsClamped(value: Date, months: number): Date {
  const d = startOfDay(value);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay));
}

export function presetDate(id: DuePreset['id'], now: Date = new Date()): Date {
  const today = startOfDay(now);
  switch (id) {
    case '1w':
      return addDays(today, 7);
    case '2w':
      return addDays(today, 14);
    case '3w':
      return addDays(today, 21);
    case '1m':
      return addMonthsClamped(today, 1);
  }
}

/** The preset a date corresponds to, if any (for highlighting the chip). */
export function matchPreset(date: Date, now: Date = new Date()): DuePreset['id'] | null {
  for (const p of DUE_PRESETS) {
    if (calendarDaysBetween(presetDate(p.id, now), date) === 0) return p.id;
  }
  return null;
}

export function defaultDueDate(now: Date = new Date()): Date {
  return addDays(startOfDay(now), DEFAULT_LOAN_DAYS);
}

export function minDueDate(now: Date = new Date()): Date {
  return startOfDay(now);
}

/** The backend accepts up to a year ahead; stay a day inside that. */
export function maxDueDate(now: Date = new Date()): Date {
  return addDays(startOfDay(now), 365);
}

export function isSelectableDueDate(date: Date, now: Date = new Date()): boolean {
  const d = startOfDay(date).getTime();
  return d >= minDueDate(now).getTime() && d <= maxDueDate(now).getTime();
}

/**
 * ISO string sent to the backend: local noon on the chosen day, so the stored instant falls
 * on that calendar day in every time zone the app is likely used in.
 */
export function dueDateToIso(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString();
}

/** "in 3 weeks", "tomorrow", "today", "in 10 days". */
export function relativeDueLabel(date: Date, now: Date = new Date()): string {
  const days = calendarDaysBetween(now, date);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days % 7 === 0 && days <= 56) return `in ${days / 7} week${days === 7 ? '' : 's'}`;
  return `in ${days} days`;
}

// ---------- Calendar ----------

export const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Weeks (Monday first) for a month; days outside the month are null.
 * Always whole weeks, 4–6 rows.
 */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function isSameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b && calendarDaysBetween(a, b) === 0;
}

/** Month index arithmetic: shift { year, month } by `delta` months. */
export function shiftMonth(
  ym: { year: number; month: number },
  delta: number
): { year: number; month: number } {
  const d = new Date(ym.year, ym.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
