import { asBorrower, day, hoursAgo, loan, NOW, ts } from '@/features/loans/__fixtures__/loans';
import {
  cardLoans,
  inPickupWindow,
  needsYou,
  needsYouBadge,
  pickupWindowEnds,
} from '@/features/loans/needs-you';
import { expiryLabel } from '@/features/loans/buckets';

const kinds = (cards: ReturnType<typeof needsYou>) =>
  cards.map((c) => `${c.kind}:${c.key.split(':')[1]}`);

describe('inPickupWindow', () => {
  const accepted = { status: 'active' as const, requestedAt: ts(day(-1)) };

  it('is true for 48 h after an accepted request', () => {
    expect(inPickupWindow({ ...accepted, startedAt: ts(hoursAgo(1)) }, NOW)).toBe(true);
    expect(inPickupWindow({ ...accepted, startedAt: ts(hoursAgo(47.9)) }, NOW)).toBe(true);
    expect(inPickupWindow({ ...accepted, startedAt: ts(hoursAgo(48)) }, NOW)).toBe(false);
    expect(inPickupWindow({ ...accepted, startedAt: ts(hoursAgo(72)) }, NOW)).toBe(false);
  });

  it('ends early once a return has been talked about (QA Pixel B)', () => {
    const fresh = { ...accepted, startedAt: ts(hoursAgo(1)) };
    expect(inPickupWindow({ ...fresh, notBackYetAt: ts(hoursAgo(0.5)) }, NOW)).toBe(false);
    expect(inPickupWindow({ ...fresh, returnMarkedAt: ts(hoursAgo(0.5)) }, NOW)).toBe(false);
    expect(
      inPickupWindow(
        { ...fresh, returnEvents: [{ kind: 'returnMarked', at: ts(hoursAgo(0.5)) }] },
        NOW
      )
    ).toBe(false);
    expect(inPickupWindow({ ...fresh, returnEvents: [] }, NOW)).toBe(true);
  });

  it('never applies to loans recorded by hand or that are not active', () => {
    expect(
      inPickupWindow({ status: 'active', requestedAt: null, startedAt: ts(hoursAgo(1)) }, NOW)
    ).toBe(false);
    expect(
      inPickupWindow({ ...accepted, status: 'returnPending', startedAt: ts(hoursAgo(1)) }, NOW)
    ).toBe(false);
    expect(inPickupWindow({ ...accepted, startedAt: null }, NOW)).toBe(false);
  });

  it('treats a startedAt slightly in the future (clock skew) as inside the window', () => {
    const future = new Date(NOW.getTime() + 2000);
    expect(inPickupWindow({ ...accepted, startedAt: ts(future) }, NOW)).toBe(true);
  });

  it('ends at startedAt + 48 h', () => {
    expect(pickupWindowEnds({ requestedAt: ts(day(-1)), startedAt: ts(hoursAgo(10)) })).toEqual(
      new Date(NOW.getTime() + 38 * 3_600_000)
    );
    expect(pickupWindowEnds({ requestedAt: null, startedAt: ts(hoursAgo(10)) })).toBeNull();
  });
});

describe('needsYou', () => {
  it('makes a card for each thing I must act on (F5) and nothing else', () => {
    const owner = [
      loan({ status: 'requested', requestedAt: ts(day(-1)) }, 'req'),
      loan({ status: 'returnPending', returnMarkedAt: ts(day(-1)) }, 'says'),
      loan({ status: 'active', dueDate: ts(day(-3)), startedAt: ts(day(-25)) }, 'overdue'),
      loan({ status: 'active', dueDate: ts(day(1)), startedAt: ts(day(-20)) }, 'lent-due-soon'),
      loan({ status: 'active', dueDate: ts(day(10)), startedAt: ts(day(-5)) }, 'lent-fine'),
      loan({ status: 'returned' }, 'closed'),
    ];
    const borrower = [
      asBorrower({ status: 'active', dueDate: ts(day(1)), startedAt: ts(day(-20)) }, 'due'),
      asBorrower({ status: 'active', dueDate: ts(day(-1)), startedAt: ts(day(-22)) }, 'b-overdue'),
      asBorrower({ status: 'active', dueDate: ts(day(10)), startedAt: ts(day(-5)) }, 'b-fine'),
      asBorrower(
        {
          status: 'active',
          requestedAt: ts(day(-2)),
          startedAt: ts(hoursAgo(5)),
          dueDate: ts(day(21)),
        },
        'pickup'
      ),
      asBorrower({ status: 'returnPending', dueDate: ts(day(-1)) }, 'b-pending'),
      // Other Books than the accepted 'pickup' loan (same Book would be an R14 card).
      asBorrower({ status: 'requested', requestedAt: ts(day(-6)), workId: 'w2' }, 'expiring'),
      asBorrower({ status: 'requested', requestedAt: ts(day(-1)), workId: 'w3' }, 'fresh-request'),
      asBorrower({ status: 'ownerLeft' }, 'left'),
    ];
    const cards = needsYou('me', owner, borrower, NOW);
    expect(kinds(cards).sort()).toEqual(
      [
        'requests:item-req',
        'saysReturned:says',
        'overdueLent:overdue',
        'dueBorrowed:due',
        'dueBorrowed:b-overdue',
        'pickup:pickup',
        'requestExpiring:expiring',
      ].sort()
    );
    expect(needsYouBadge(cards)).toBe(7);
  });

  it('orders by oldest deadline first; past deadlines before future ones', () => {
    const cards = needsYou(
      'me',
      [
        // expires day 6
        loan({ status: 'requested', requestedAt: ts(day(-1)) }, 'req'),
        // was due 3 days ago
        loan({ status: 'active', dueDate: ts(day(-3)), startedAt: ts(day(-25)) }, 'overdue'),
        // said returned yesterday
        loan({ status: 'returnPending', returnMarkedAt: ts(day(-1)) }, 'says'),
      ],
      [
        // due tomorrow
        asBorrower({ status: 'active', dueDate: ts(day(1)), startedAt: ts(day(-20)) }, 'due'),
        // window ends in 43 h
        asBorrower(
          {
            status: 'active',
            requestedAt: ts(day(-1)),
            startedAt: ts(hoursAgo(5)),
            dueDate: ts(day(21)),
          },
          'pickup'
        ),
      ],
      NOW
    );
    expect(kinds(cards)).toEqual([
      'overdueLent:overdue',
      'saysReturned:says',
      'dueBorrowed:due',
      'pickup:pickup',
      'requests:item-req',
    ]);
  });

  it('groups requests for one copy into one card, oldest first, counted once', () => {
    const a = loan({ status: 'requested', itemId: 'sapiens', requestedAt: ts(day(-1)) }, 'kabir');
    const b = loan({ status: 'requested', itemId: 'sapiens', requestedAt: ts(day(-3)) }, 'ravi');
    const c = loan({ status: 'returnPending', returnMarkedAt: ts(day(-1)) }, 'says');
    const cards = needsYou('me', [a, b, c], [], NOW);
    expect(cards).toHaveLength(2);
    const group = cards.find((x) => x.kind === 'requests')!;
    expect(cardLoans(group).map((l) => l.id)).toEqual(['ravi', 'kabir']);
    expect(needsYouBadge(cards)).toBe(2);
  });

  it('acceptance C2: one incoming request + one says-returned = badge 2', () => {
    const cards = needsYou(
      'me',
      [
        loan({ status: 'requested', requestedAt: ts(day(-1)) }),
        loan({ status: 'returnPending', returnMarkedAt: ts(day(0)) }),
      ],
      [],
      NOW
    );
    expect(needsYouBadge(cards)).toBe(2);
    expect(needsYouBadge([])).toBeUndefined();
  });

  it('hides the owner nudge card during the pick-up window', () => {
    const owner = loan({
      status: 'active',
      requestedAt: ts(day(-1)),
      startedAt: ts(hoursAgo(2)),
      dueDate: ts(day(-1)), // odd but possible: due date set to the past day
    });
    expect(needsYou('me', [owner], [], NOW)).toEqual([]);
  });

  it('switches from the pick-up card to normal once 48 h have passed', () => {
    const l = asBorrower({
      status: 'active',
      requestedAt: ts(day(-3)),
      startedAt: ts(hoursAgo(49)),
      dueDate: ts(day(19)),
    });
    expect(needsYou('me', [], [l], NOW)).toEqual([]);
    expect(needsYou('me', [], [l], hoursAgo(10)).map((c) => c.kind)).toEqual(['pickup']);
  });

  it('ignores duplicates across the two lists and other people’s loans', () => {
    const l = loan({ status: 'returnPending' });
    const other = loan({ status: 'returnPending', ownerId: 'x', borrowerUid: 'y' });
    expect(needsYou('me', [l, other], [l], NOW)).toHaveLength(1);
  });
});

describe('QA B1: "Not back yet" for the borrower', () => {
  it('is a card for 3 days, then only the row and Loan screen say it', () => {
    const fresh = asBorrower({
      status: 'active',
      dueDate: ts(day(10)),
      startedAt: ts(day(-11)),
      requestedAt: ts(day(-12)),
      notBackYetAt: ts(hoursAgo(5)),
    });
    expect(kinds(needsYou('me', [], [fresh], NOW))).toEqual([`notBackYet:${fresh.id}`]);
    const old = { ...fresh, notBackYetAt: ts(day(-4)) };
    expect(needsYou('me', [], [old], NOW)).toEqual([]);
  });
});

describe('QA B14: requests past 7 days', () => {
  it('are not cards, and never say "expires today"', () => {
    const old = loan({ status: 'requested', requestedAt: ts(day(-8)) });
    expect(needsYou('me', [old], [], NOW)).toEqual([]);
    expect(expiryLabel(old, NOW)).toBe('expired');
  });
});

describe('QA B14: order within a day', () => {
  it('puts the older request first even when its item id sorts later', () => {
    const older = loan(
      { status: 'requested', itemId: 'z-midnight', requestedAt: ts(hoursAgo(5)) },
      'older'
    );
    const newer = loan(
      { status: 'requested', itemId: 'a-gatsby', requestedAt: ts(hoursAgo(1)) },
      'newer'
    );
    expect(needsYou('me', [newer, older], [], NOW).map((c) => c.key)).toEqual([
      'requests:z-midnight',
      'requests:a-gatsby',
    ]);
  });
});
