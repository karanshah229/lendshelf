/**
 * Due-date choices for accepting a request and changing a due date.
 * The backend accepts today … +1 year (DECISIONS #12); dates travel as `YYYY-MM-DD`.
 */
import { addDays, calendarDaysBetween, startOfDay, toISODate, type DateInput } from '@/lib/dates';
import { DEFAULT_LOAN_DAYS } from '@/types/model';

export const MAX_DUE_DAYS = 365;

export interface DueChip {
  /** Stable key. */
  key: string;
  label: string;
  date: Date;
}

/** Chips when accepting a request or lending: counted from today. 3 weeks is the default. */
export const ACCEPT_CHIP_DAYS = [7, 14, DEFAULT_LOAN_DAYS, 30, 60] as const;
/** Chips when changing a due date: extensions from the current due date. */
export const EXTEND_CHIP_DAYS = [7, 14, 30] as const;

/** "1 week", "3 weeks", "1 month", "2 months", "10 days". */
export function durationLabel(days: number): string {
  if (days % 30 === 0) {
    const m = days / 30;
    return `${m} month${m === 1 ? '' : 's'}`;
  }
  if (days % 7 === 0) {
    const w = days / 7;
    return `${w} week${w === 1 ? '' : 's'}`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** Keeps a due date between today and today + 1 year (whole local days). */
export function clampDueDate(value: DateInput, now: Date = new Date()): Date {
  const today = startOfDay(now);
  const d = startOfDay(value);
  const max = addDays(today, MAX_DUE_DAYS);
  if (d < today) return today;
  if (d > max) return max;
  return d;
}

/** Chips counted from today: 1 week … 2 months. */
export function acceptChips(now: Date = new Date()): DueChip[] {
  const today = startOfDay(now);
  return ACCEPT_CHIP_DAYS.map((days) => ({
    key: `in-${days}`,
    label: durationLabel(days),
    date: addDays(today, days),
  }));
}

/**
 * Extension chips ("+1 week", …) counted from the current due date, or from today when the
 * loan is overdue or has no due date. Chips beyond the 1-year limit are dropped.
 */
export function extendChips(currentDue: DateInput | null, now: Date = new Date()): DueChip[] {
  const today = startOfDay(now);
  const base = currentDue ? clampDueDate(currentDue, now) : today;
  const max = addDays(today, MAX_DUE_DAYS);
  return EXTEND_CHIP_DAYS.map((days) => ({
    key: `plus-${days}`,
    label: `+${durationLabel(days)}`,
    date: addDays(base, days),
  })).filter((c) => c.date <= max);
}

/** Default selection when accepting a request: today + 21 days. */
export function defaultDueDate(now: Date = new Date()): Date {
  return addDays(startOfDay(now), DEFAULT_LOAN_DAYS);
}

/** Moves a date by `delta` days, staying within the allowed range. */
export function shiftDueDate(value: Date, delta: number, now: Date = new Date()): Date {
  return clampDueDate(addDays(value, delta), now);
}

/** Whether a date is the same local calendar day. */
export function sameDay(a: DateInput, b: DateInput): boolean {
  return calendarDaysBetween(a, b) === 0;
}

/** Wire format for `respondToRequest` / `updateDueDate`. */
export function dueDateParam(value: Date): string {
  return toISODate(value);
}

/** "in 3 weeks" style hint under the picked date. */
export function relativeDueHint(value: DateInput, now: Date = new Date()): string {
  const days = calendarDaysBetween(now, value);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${durationLabel(days)}`;
}
