import {
  addDays,
  backLabel,
  calendarDaysBetween,
  dueLabel,
  dueState,
  formatLongDate,
  formatShortDate,
  isOverdue,
  timeAgo,
  toISODate,
} from '@/lib/dates';

// Local-time dates keep the tests independent of the machine's time zone.
const NOW = new Date(2026, 10, 21, 15, 30); // 21 Nov 2026, 15:30
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

const ts = (date: Date) => ({
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
  toDate: () => date,
  toMillis: () => date.getTime(),
});

describe('formatting', () => {
  it('formatShortDate omits the current year', () => {
    expect(formatShortDate(day(2026, 12, 12), NOW)).toBe('12 Dec');
    expect(formatShortDate(day(2027, 1, 3), NOW)).toBe('3 Jan 2027');
  });

  it('accepts Timestamp-like values and millis', () => {
    expect(formatShortDate(ts(day(2026, 12, 12)), NOW)).toBe('12 Dec');
    expect(formatShortDate(day(2026, 12, 12).getTime(), NOW)).toBe('12 Dec');
  });

  it('formatLongDate and toISODate', () => {
    expect(formatLongDate(day(2026, 3, 5))).toBe('5 Mar 2026');
    expect(toISODate(day(2026, 3, 5))).toBe('2026-03-05');
  });
});

describe('calendar arithmetic', () => {
  it('counts calendar days, ignoring time of day', () => {
    expect(calendarDaysBetween(day(2026, 11, 21, 23), day(2026, 11, 22, 1))).toBe(1);
    expect(calendarDaysBetween(day(2026, 11, 21), day(2026, 11, 18))).toBe(-3);
    expect(calendarDaysBetween(day(2026, 12, 31), day(2027, 1, 1))).toBe(1);
  });

  it('addDays crosses month and year boundaries', () => {
    expect(toISODate(addDays(day(2026, 12, 25), 21))).toBe('2027-01-15');
  });
});

describe('dueState', () => {
  it.each([
    [day(2026, 11, 18), { kind: 'overdue', days: 3 }],
    [day(2026, 11, 21, 8), { kind: 'today' }],
    [day(2026, 11, 22), { kind: 'soon', days: 1 }],
    [day(2026, 11, 23), { kind: 'soon', days: 2 }],
    [day(2026, 11, 30), { kind: 'later', days: 9 }],
  ])('%s', (due, expected) => {
    expect(dueState(due, NOW)).toEqual(expected);
  });
});

describe('labels', () => {
  it('backLabel', () => {
    expect(backLabel(day(2026, 12, 12), NOW)).toBe('back 12 Dec');
    expect(backLabel(day(2026, 11, 21), NOW)).toBe('back today');
    expect(backLabel(day(2026, 11, 18), NOW)).toBe('overdue 3 days');
    expect(backLabel(day(2026, 11, 20), NOW)).toBe('overdue 1 day');
    expect(backLabel(null, NOW)).toBe('lent out');
  });

  it('dueLabel', () => {
    expect(dueLabel(day(2026, 12, 12), NOW)).toBe('due 12 Dec');
    expect(dueLabel(day(2026, 11, 22), NOW)).toBe('due tomorrow');
    expect(dueLabel(day(2026, 11, 21), NOW)).toBe('due today');
    expect(dueLabel(day(2026, 11, 14), NOW)).toBe('overdue 7 days');
    expect(dueLabel(undefined, NOW)).toBe('no due date');
  });

  it('isOverdue', () => {
    expect(isOverdue(day(2026, 11, 20), NOW)).toBe(true);
    expect(isOverdue(day(2026, 11, 21), NOW)).toBe(false);
    expect(isOverdue(null, NOW)).toBe(false);
  });

  it('timeAgo', () => {
    expect(timeAgo(new Date(NOW.getTime() - 30_000), NOW)).toBe('just now');
    expect(timeAgo(new Date(NOW.getTime() - 5 * 60_000), NOW)).toBe('5 min ago');
    expect(timeAgo(new Date(NOW.getTime() - 3 * 3_600_000), NOW)).toBe('3 h ago');
    expect(timeAgo(day(2026, 11, 20), NOW)).toBe('yesterday');
    expect(timeAgo(day(2026, 11, 17), NOW)).toBe('4 days ago');
    expect(timeAgo(day(2026, 10, 1), NOW)).toBe('1 Oct');
  });
});
