import { statusBadgeText } from '@/lib/status-text';
import type { ItemStatus } from '@/types/model';

const NOW = new Date(2026, 10, 21, 12);
const lent = (due: Date | null, extra: Partial<Extract<ItemStatus, { kind: 'lent' }>> = {}) =>
  ({ kind: 'lent', dueDate: due, withMe: false, ...extra }) as ItemStatus;

describe('statusBadgeText', () => {
  it('names every simple status in words', () => {
    expect(statusBadgeText({ kind: 'available' } as ItemStatus)).toBe('Available');
    expect(statusBadgeText({ kind: 'requested' } as ItemStatus)).toBe('Requested');
    expect(statusBadgeText({ kind: 'notLendable' } as ItemStatus)).toBe('Not lending');
    expect(statusBadgeText({ kind: 'hidden' } as ItemStatus)).toBe('Hidden');
  });

  it('gives the back date, or overdue in words', () => {
    expect(statusBadgeText(lent(new Date(2026, 10, 28)), {}, NOW)).toBe('Lent · back 28 Nov');
    expect(statusBadgeText(lent(new Date(2026, 10, 18)), {}, NOW)).toBe('Lent · overdue 3 days');
    expect(statusBadgeText(lent(new Date(2026, 10, 28)), { owner: true }, NOW)).toBe(
      'Out · back 28 Nov'
    );
    expect(statusBadgeText(lent(new Date(2026, 10, 28), { withMe: true }), {}, NOW)).toBe(
      'With you · back 28 Nov'
    );
  });

  it('compact drops the date but never hides overdue (F8)', () => {
    expect(statusBadgeText(lent(new Date(2026, 10, 28)), { compact: true }, NOW)).toBe('Lent');
    expect(statusBadgeText(lent(new Date(2026, 10, 18)), { compact: true }, NOW)).toBe(
      'Lent · overdue'
    );
    expect(statusBadgeText(lent(null), {}, NOW)).toBe('Lent');
  });
});
