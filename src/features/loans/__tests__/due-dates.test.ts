import {
  acceptChips,
  clampDueDate,
  defaultDueDate,
  dueDateParam,
  durationLabel,
  extendChips,
  relativeDueHint,
  shiftDueDate,
} from '@/features/loans/due-dates';

const NOW = new Date(2026, 10, 21, 15, 30); // 21 Nov 2026, local time
const d = (y: number, m: number, day: number) => new Date(y, m, day);

describe('durationLabel', () => {
  it.each([
    [1, '1 day'],
    [7, '1 week'],
    [14, '2 weeks'],
    [21, '3 weeks'],
    [30, '1 month'],
    [60, '2 months'],
    [10, '10 days'],
  ])('%p → %p', (days, label) => expect(durationLabel(days)).toBe(label));
});

describe('acceptChips', () => {
  it('offers 1 week … 2 months from today at midnight', () => {
    const chips = acceptChips(NOW);
    expect(chips.map((c) => c.label)).toEqual([
      '1 week',
      '2 weeks',
      '3 weeks',
      '1 month',
      '2 months',
    ]);
    expect(chips[0]!.date).toEqual(d(2026, 10, 28));
    expect(chips[2]!.date).toEqual(d(2026, 11, 12));
    expect(chips[4]!.date).toEqual(d(2027, 0, 20));
  });

  it('defaults to 21 days', () => {
    expect(defaultDueDate(NOW)).toEqual(d(2026, 11, 12));
    expect(dueDateParam(defaultDueDate(NOW))).toBe('2026-12-12');
  });
});

describe('extendChips', () => {
  it('extends from the current due date', () => {
    const chips = extendChips(d(2026, 11, 1), NOW);
    expect(chips.map((c) => c.label)).toEqual(['+1 week', '+2 weeks', '+1 month']);
    expect(chips[0]!.date).toEqual(d(2026, 11, 8));
  });

  it('extends from today when overdue or undated', () => {
    expect(extendChips(d(2026, 10, 1), NOW)[0]!.date).toEqual(d(2026, 10, 28));
    expect(extendChips(null, NOW)[0]!.date).toEqual(d(2026, 10, 28));
  });

  it('drops chips past the 1-year limit', () => {
    const chips = extendChips(d(2027, 10, 1), NOW);
    expect(chips.map((c) => c.label)).toEqual(['+1 week', '+2 weeks']);
  });
});

describe('clampDueDate / shiftDueDate', () => {
  it('keeps dates between today and +1 year', () => {
    expect(clampDueDate(d(2026, 0, 1), NOW)).toEqual(d(2026, 10, 21));
    expect(clampDueDate(d(2030, 0, 1), NOW)).toEqual(d(2027, 10, 21));
    expect(clampDueDate(new Date(2026, 11, 3, 18, 0), NOW)).toEqual(d(2026, 11, 3));
  });

  it('steps by days within the range', () => {
    expect(shiftDueDate(d(2026, 10, 21), -1, NOW)).toEqual(d(2026, 10, 21));
    expect(shiftDueDate(d(2026, 10, 30), 1, NOW)).toEqual(d(2026, 11, 1));
    expect(shiftDueDate(d(2027, 10, 21), 1, NOW)).toEqual(d(2027, 10, 21));
  });
});

describe('relativeDueHint', () => {
  it('describes the distance from today', () => {
    expect(relativeDueHint(d(2026, 10, 21), NOW)).toBe('today');
    expect(relativeDueHint(d(2026, 10, 22), NOW)).toBe('tomorrow');
    expect(relativeDueHint(d(2026, 11, 12), NOW)).toBe('in 3 weeks');
    expect(relativeDueHint(d(2026, 10, 26), NOW)).toBe('in 5 days');
  });
});
