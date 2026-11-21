import { day, NOW, ts } from '@/features/loans/__fixtures__/loans';
import {
  HOME_MAX_CARDS,
  homeNeedsYou,
  seeAllLabel,
  setupCardState,
  statusStripText,
} from '@/features/home/home';

describe('Home Needs-you slice (R13)', () => {
  it('shows at most 2 cards and "See all n in Loans" with the total', () => {
    const four = homeNeedsYou(['a', 'b', 'c', 'd']);
    expect(four).toEqual({ shown: ['a', 'b'], total: 4, seeAll: 4 });
    expect(seeAllLabel(four.seeAll!)).toBe('See all 4 in Loans');
    expect(HOME_MAX_CARDS).toBe(2);
  });

  it('no link when every card fits; nothing when empty', () => {
    expect(homeNeedsYou(['a', 'b'])).toEqual({ shown: ['a', 'b'], total: 2, seeAll: null });
    expect(homeNeedsYou(['a'])).toEqual({ shown: ['a'], total: 1, seeAll: null });
    expect(homeNeedsYou([])).toEqual({ shown: [], total: 0, seeAll: null });
  });
});

describe('status strip', () => {
  const active = (offset: number) => ({ status: 'active' as const, dueDate: ts(day(offset)) });

  it('counts both sides and gives my next due date', () => {
    expect(statusStripText([active(5), active(9)], [active(21)], NOW)).toBe(
      '2 out with friends · 1 with you, due 12 Dec'
    );
    expect(statusStripText([], [active(21), active(1)], NOW)).toBe('2 with you, next due tomorrow');
  });

  it('with nothing borrowed, the next copy due back to me', () => {
    expect(statusStripText([active(9), active(5)], [], NOW)).toBe(
      '2 out with friends, next back 26 Nov'
    );
  });

  it('overdue in words; returned books have no date; null with no open loans', () => {
    expect(statusStripText([], [active(-3)], NOW)).toBe('1 with you, overdue 3 days');
    expect(statusStripText([], [active(-9), active(4), active(10)], NOW)).toBe(
      '3 with you, 1 overdue'
    );
    expect(statusStripText([active(-2), active(-1), active(3)], [], NOW)).toBe(
      '3 out with friends, 2 overdue'
    );
    expect(statusStripText([], [{ status: 'returnPending', dueDate: ts(day(2)) }], NOW)).toBe(
      '1 with you'
    );
    expect(statusStripText([], [], NOW)).toBeNull();
  });
});

describe('setup card (E2a, R13)', () => {
  const base = {
    hasPeople: true,
    hasBooks: false,
    hasPickup: false,
    dismissed: false,
    needsYouCount: 0,
  };

  it('counts steps and makes the first unfinished one the primary', () => {
    expect(setupCardState(base)).toMatchObject({ done: 1, primary: 'books', canDismiss: false });
    expect(setupCardState({ ...base, hasPeople: false, hasBooks: true })).toMatchObject({
      done: 1,
      primary: 'people',
    });
  });

  it('is hidden while Needs you has cards', () => {
    expect(setupCardState({ ...base, needsYouCount: 1 })).toBeNull();
  });

  it('can be dismissed once two steps are done, and disappears when all are', () => {
    const two = { ...base, hasBooks: true };
    expect(setupCardState(two)).toMatchObject({ done: 2, primary: 'pickup', canDismiss: true });
    expect(setupCardState({ ...two, dismissed: true })).toBeNull();
    // A dismissal before two steps were done doesn't hide it.
    expect(setupCardState({ ...base, dismissed: true })).not.toBeNull();
    expect(setupCardState({ ...two, hasPickup: true })).toBeNull();
  });
});
