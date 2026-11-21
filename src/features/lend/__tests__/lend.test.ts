import { buildBorrowerOptions, lentMessage } from '@/features/lend/borrowers';
import {
  addMonthsClamped,
  defaultDueDate,
  dueDateToIso,
  isSameDay,
  isSelectableDueDate,
  matchPreset,
  maxDueDate,
  monthGrid,
  presetDate,
  relativeDueLabel,
  shiftMonth,
} from '@/features/lend/due-date';

const NOW = new Date(2026, 10, 21, 15, 30); // Sat 21 Nov 2026, 15:30 local
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('due date presets', () => {
  it('computes presets from today', () => {
    expect(presetDate('1w', NOW)).toEqual(day(2026, 11, 28));
    expect(presetDate('2w', NOW)).toEqual(day(2026, 12, 5));
    expect(presetDate('3w', NOW)).toEqual(day(2026, 12, 12));
    expect(presetDate('1m', NOW)).toEqual(day(2026, 12, 21));
  });

  it('defaults to 21 days', () => {
    expect(defaultDueDate(NOW)).toEqual(day(2026, 12, 12));
    expect(matchPreset(defaultDueDate(NOW), NOW)).toBe('3w');
    expect(matchPreset(day(2026, 12, 13), NOW)).toBeNull();
  });

  it('clamps month arithmetic to the end of the month', () => {
    expect(addMonthsClamped(day(2027, 1, 31), 1)).toEqual(day(2027, 2, 28));
    expect(addMonthsClamped(day(2028, 1, 31), 1)).toEqual(day(2028, 2, 29));
    expect(addMonthsClamped(day(2026, 12, 15), 1)).toEqual(day(2027, 1, 15));
  });

  it('allows today up to a year ahead', () => {
    expect(isSelectableDueDate(day(2026, 11, 21), NOW)).toBe(true);
    expect(isSelectableDueDate(day(2026, 11, 20), NOW)).toBe(false);
    expect(isSelectableDueDate(maxDueDate(NOW), NOW)).toBe(true);
    expect(isSelectableDueDate(day(2027, 11, 22), NOW)).toBe(false);
  });

  it('sends local noon as ISO', () => {
    const iso = dueDateToIso(day(2026, 12, 12));
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(11);
    expect(parsed.getDate()).toBe(12);
    expect(parsed.getHours()).toBe(12);
  });

  it('describes how far away a date is', () => {
    expect(relativeDueLabel(day(2026, 11, 21), NOW)).toBe('today');
    expect(relativeDueLabel(day(2026, 11, 22), NOW)).toBe('tomorrow');
    expect(relativeDueLabel(day(2026, 11, 28), NOW)).toBe('in 1 week');
    expect(relativeDueLabel(day(2026, 12, 12), NOW)).toBe('in 3 weeks');
    expect(relativeDueLabel(day(2026, 12, 1), NOW)).toBe('in 10 days');
  });
});

describe('calendar grid', () => {
  it('lays out a month Monday-first in whole weeks', () => {
    const weeks = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]?.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0]?.[6]).toEqual(day(2026, 11, 1));
    expect(weeks[5]?.[0]).toEqual(day(2026, 11, 30));
    expect(weeks[5]?.[1]).toBeNull();
  });

  it('handles a month starting on Monday', () => {
    const weeks = monthGrid(2027, 1); // February 2027 starts on a Monday
    expect(weeks).toHaveLength(4);
    expect(weeks[0]?.[0]).toEqual(day(2027, 2, 1));
  });

  it('shifts months across years and compares days', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(isSameDay(new Date(2026, 10, 21, 1), new Date(2026, 10, 21, 23))).toBe(true);
    expect(isSameDay(null, NOW)).toBe(false);
  });
});

describe('buildBorrowerOptions', () => {
  const linked = [
    { ownerId: 'u1', ownerPhone: '+919000000001', displayName: 'Asha Rao' },
    { ownerId: 'u2', ownerPhone: '+919000000002', displayName: 'Ravi Menon' },
  ];
  const device = [
    { name: 'Asha (work)', phone: '+919000000001' },
    { name: 'Gita Nair', phone: '+919811122233' },
    { name: 'Ramesh', phone: '+919822233344' },
  ];

  it('lists app users first and skips their numbers among phone contacts', () => {
    const o = buildBorrowerOptions(linked, device, '');
    expect(o.onApp.map((b) => b.uid)).toEqual(['u1', 'u2']);
    expect(o.contacts.map((b) => b.name)).toEqual(['Gita Nair', 'Ramesh']);
    expect(o.contacts[0]?.uid).toBeNull();
  });

  it('filters by name (accent/case-insensitive) or digits', () => {
    expect(buildBorrowerOptions(linked, device, 'ra').onApp.map((b) => b.name)).toEqual([
      'Asha Rao',
      'Ravi Menon',
    ]);
    const byName = buildBorrowerOptions(linked, device, 'gita');
    expect(byName.onApp).toEqual([]);
    expect(byName.contacts.map((b) => b.name)).toEqual(['Gita Nair']);
    const byDigits = buildBorrowerOptions(linked, device, '98222');
    expect(byDigits.contacts.map((b) => b.name)).toEqual(['Ramesh']);
  });
});

describe('lentMessage', () => {
  it('mentions the book and due date', () => {
    expect(
      lentMessage({
        borrowerName: 'Ravi Menon',
        title: 'Dune',
        dueDate: day(2026, 12, 12),
        now: NOW,
      })
    ).toBe(
      "Hi Ravi! Here's “Dune”, enjoy! Could you get it back to me by 12 Dec? I've noted it on LendShelf."
    );
    expect(lentMessage({ borrowerName: 'Gita', title: 'Dune', dueDate: null })).toContain(
      "Here's “Dune”"
    );
    // Someone who isn't on the app is greeted without the name typed in (R21).
    expect(lentMessage({ borrowerName: null, title: 'Dune', dueDate: null })).toMatch(
      /^Hi! Here's/
    );
  });
});
