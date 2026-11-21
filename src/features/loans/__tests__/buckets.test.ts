import { asBorrower, day, hoursAgo, loan, NOW, ts } from '@/features/loans/__fixtures__/loans';
import {
  bucketLoans,
  canOpenCopy,
  closedStatusLabel,
  expiryLabel,
  filterHistory,
  historyKind,
  loanStatusLabel,
  openRowLine,
  recentLine,
  requestDaysLeft,
  requestRowLine,
} from '@/features/loans/buckets';

describe('bucketLoans (the Loans ledger)', () => {
  it('puts every loan state in the right section', () => {
    const owner = [
      loan({ status: 'requested', requestedAt: ts(day(-1)) }, 'in1'),
      loan({ status: 'active', dueDate: ts(day(5)) }, 'lent1'),
      loan({ status: 'returnPending', dueDate: ts(day(10)) }, 'lent2'),
      loan({ status: 'returned', returnedAt: ts(day(-3)) }, 'hist-lent'),
      loan({ status: 'declined', updatedAt: ts(day(-2)) }, 'hist-req1'),
      loan({ status: 'cancelled', closedReason: 'notCollected', updatedAt: ts(day(-4)) }, 'nc'),
    ];
    const borrower = [
      asBorrower({ status: 'requested', requestedAt: ts(day(-1)) }, 'out1'),
      asBorrower({ status: 'active', dueDate: ts(day(2)) }, 'bor1'),
      asBorrower({ status: 'returned', returnedAt: ts(day(-5)) }, 'hist-bor'),
      asBorrower({ status: 'expired', updatedAt: ts(day(-1)) }, 'hist-req2'),
      asBorrower({ status: 'ownerLeft', updatedAt: ts(day(-6)) }, 'left'),
    ];
    const b = bucketLoans('me', owner, borrower, NOW);
    expect(b.incoming.map((l) => l.id)).toEqual(['in1']);
    expect(b.yourRequests.map((l) => l.id)).toEqual(['out1']);
    expect(b.outWithFriends.map((l) => l.id)).toEqual(['lent1', 'lent2']); // by due date
    expect(b.withYou.map((l) => l.id)).toEqual(['bor1']);
    expect(b.history.map((l) => l.id)).toEqual([
      'hist-req2',
      'hist-req1',
      'hist-lent',
      'nc',
      'hist-bor',
      'left',
    ]);
    expect(b.recent.map((l) => l.id)).toEqual(b.history.map((l) => l.id));
  });

  it('keeps Recent to 14 days and 10 rows', () => {
    const old = loan({ status: 'returned', returnedAt: ts(day(-15)) }, 'old');
    const many = Array.from({ length: 12 }, (_, i) =>
      loan({ status: 'declined', updatedAt: ts(day(-i)) }, `d${i}`)
    );
    const b = bucketLoans('me', [old, ...many], [], NOW);
    expect(b.recent).toHaveLength(10);
    expect(b.recent.map((l) => l.id)).not.toContain('old');
    expect(b.history).toHaveLength(13);
  });

  it('orders requests: mine newest first, incoming oldest first', () => {
    const b = bucketLoans(
      'me',
      [
        loan({ status: 'requested', requestedAt: ts(day(-1)) }, 'new'),
        loan({ status: 'requested', requestedAt: ts(day(-5)) }, 'old'),
      ],
      [
        asBorrower({ status: 'requested', requestedAt: ts(day(-5)) }, 'o-old'),
        asBorrower({ status: 'requested', requestedAt: ts(day(-1)) }, 'o-new'),
      ],
      NOW
    );
    expect(b.incoming.map((l) => l.id)).toEqual(['old', 'new']);
    expect(b.yourRequests.map((l) => l.id)).toEqual(['o-new', 'o-old']);
  });

  it('sorts by due date, undated last, and puts "waiting for confirmation" last in With you', () => {
    const b = bucketLoans(
      'me',
      [
        loan({ status: 'active', dueDate: null }, 'none'),
        loan({ status: 'active', dueDate: ts(day(9)) }, 'later'),
        loan({ status: 'active', dueDate: ts(day(-2)) }, 'overdue'),
      ],
      [
        asBorrower({ status: 'returnPending', dueDate: ts(day(-1)) }, 'b-pending'),
        asBorrower({ status: 'active', dueDate: ts(day(4)) }, 'b-active'),
      ],
      NOW
    );
    expect(b.outWithFriends.map((l) => l.id)).toEqual(['overdue', 'later', 'none']);
    expect(b.withYou.map((l) => l.id)).toEqual(['b-active', 'b-pending']);
  });

  it('ignores duplicates and loans that are not mine', () => {
    const shared = loan({ status: 'active' }, 'dup');
    const strangers = loan({ status: 'active', ownerId: 'x', borrowerUid: 'y' }, 'other');
    const b = bucketLoans('me', [shared, strangers], [shared], NOW);
    expect(b.outWithFriends.map((l) => l.id)).toEqual(['dup']);
    expect(b.withYou).toEqual([]);
  });
});

describe('history filter', () => {
  it('sorts closed loans into Lent / Borrowed / Requests', () => {
    expect(historyKind(loan({ status: 'returned' }), 'me')).toBe('lent');
    expect(historyKind(loan({ status: 'cancelled', closedReason: 'notCollected' }), 'me')).toBe(
      'lent'
    );
    expect(historyKind(asBorrower({ status: 'returned' }), 'me')).toBe('borrowed');
    expect(historyKind(asBorrower({ status: 'ownerLeft' }), 'me')).toBe('borrowed');
    expect(historyKind(asBorrower({ status: 'declined' }), 'me')).toBe('requests');
    expect(historyKind(loan({ status: 'expired' }), 'me')).toBe('requests');
    expect(historyKind(loan({ status: 'cancelled' }), 'me')).toBe('requests');
  });

  it('filters', () => {
    const list = [
      loan({ status: 'returned' }, 'a'),
      asBorrower({ status: 'returned' }, 'b'),
      loan({ status: 'declined' }, 'c'),
    ];
    expect(filterHistory(list, 'all', 'me').map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(filterHistory(list, 'lent', 'me').map((l) => l.id)).toEqual(['a']);
    expect(filterHistory(list, 'borrowed', 'me').map((l) => l.id)).toEqual(['b']);
    expect(filterHistory(list, 'requests', 'me').map((l) => l.id)).toEqual(['c']);
  });
});

describe('row lines', () => {
  it('open rows: due, overdue in words, pick-up window, says returned', () => {
    const due = loan({ status: 'active', dueDate: ts(day(16)), startedAt: ts(day(-5)) });
    expect(openRowLine(due, 'me', 'Zoya Khan', NOW)).toEqual({
      text: 'with Zoya · due 7 Dec',
      overdue: false,
    });
    const late = loan({ status: 'active', dueDate: ts(day(-3)), startedAt: ts(day(-30)) });
    expect(openRowLine(late, 'me', 'Zoya', NOW)).toEqual({
      text: 'with Zoya · 3 days overdue',
      overdue: true,
    });
    const pickup = {
      status: 'active' as const,
      requestedAt: ts(day(-2)),
      startedAt: ts(hoursAgo(5)),
      dueDate: ts(day(21)),
    };
    expect(openRowLine(loan(pickup), 'me', 'Asha', NOW).text).toBe('Waiting for Asha to pick up');
    expect(openRowLine(asBorrower(pickup), 'me', 'Ravi', NOW).text).toBe('Pick up from Ravi');
    expect(openRowLine(loan({ status: 'returnPending' }), 'me', 'Asha', NOW).text).toBe(
      'Asha says it’s back'
    );
    expect(openRowLine(asBorrower({ status: 'returnPending' }), 'me', 'Ravi', NOW).text).toBe(
      'Waiting for Ravi to confirm'
    );
  });

  it('request rows', () => {
    const l = asBorrower({ status: 'requested', requestedAt: ts(day(-2)) });
    expect(requestRowLine(l, 'Ravi Menon', NOW)).toBe(
      'You asked Ravi · 2 days ago · expires in 5 days'
    );
  });

  it('recent lines from each side, using the server reasons', () => {
    const r = (p: Parameters<typeof asBorrower>[0]) => recentLine(asBorrower(p), 'me', 'Ravi');
    expect(r({ status: 'declined', declineReason: 'readingIt' })).toBe(
      'Ravi is reading it right now'
    );
    expect(r({ status: 'declined', declineReason: 'notLending' })).toBe(
      'Ravi isn’t lending it at the moment'
    );
    expect(r({ status: 'declined' })).toBe('Ravi can’t lend it right now');
    expect(r({ status: 'declined', declineReason: 'lentToSomeoneElse' })).toBe(
      'Lent to someone else'
    );
    expect(
      recentLine(
        asBorrower({ status: 'declined', declineReason: 'lentToSomeoneElse' }),
        'me',
        'Ravi',
        {
          backAround: day(21),
          now: NOW,
        }
      )
    ).toBe('Lent to someone else · back around 12 Dec');
    expect(r({ status: 'expired' })).toBe('Your request expired');
    expect(r({ status: 'cancelled' })).toBe('You cancelled your request');
    expect(r({ status: 'cancelled', closedReason: 'notCollected' })).toBe(
      'Not collected from Ravi'
    );
    expect(r({ status: 'returned' })).toBe('Returned to Ravi');
    expect(r({ status: 'ownerLeft' })).toBe('Ravi left LendShelf');

    const o = (p: Parameters<typeof loan>[0]) => recentLine(loan(p), 'me', 'Asha');
    expect(o({ status: 'expired' })).toBe('You didn’t answer Asha’s request');
    expect(o({ status: 'cancelled' })).toBe('Asha cancelled the request');
    expect(o({ status: 'cancelled', closedReason: 'notCollected' })).toBe('Not collected by Asha');
    expect(o({ status: 'returned' })).toBe('Back from Asha');
    expect(o({ status: 'declined' })).toBe('You declined Asha’s request');
  });

  it('status badges', () => {
    expect(loanStatusLabel({ status: 'cancelled', closedReason: 'notCollected' })).toBe(
      'Not collected'
    );
    expect(loanStatusLabel({ status: 'declined', declineReason: 'lentToSomeoneElse' })).toBe(
      'Lent to someone else'
    );
    expect(loanStatusLabel({ status: 'ownerLeft' })).toBe('Owner left');
    expect(closedStatusLabel('returned')).toBe('Returned');
    expect(closedStatusLabel('expired')).toBe('Expired');
  });
});

describe('requestDaysLeft / expiryLabel', () => {
  it('counts down from 7 days after the request', () => {
    expect(requestDaysLeft({ requestedAt: ts(day(0)) }, NOW)).toBe(7);
    expect(requestDaysLeft({ requestedAt: ts(day(-6)) }, NOW)).toBe(1);
    expect(requestDaysLeft({ requestedAt: ts(day(-9)) }, NOW)).toBe(0);
    expect(requestDaysLeft({ requestedAt: null }, NOW)).toBeNull();
    expect(expiryLabel({ requestedAt: ts(day(-6)) }, NOW)).toBe('expires tomorrow');
    expect(expiryLabel({ requestedAt: ts(new Date(day(-7).getTime() + 3_600_000)) }, NOW)).toBe(
      'expires today'
    );
    // Past the 7 days: never "expires today" (QA B14).
    expect(expiryLabel({ requestedAt: ts(day(-7)) }, NOW)).toBe('expired');
    expect(expiryLabel({ requestedAt: ts(day(-2)) }, NOW)).toBe('expires in 5 days');
  });
});

describe('canOpenCopy', () => {
  it('allows my copies and copies of people I have saved', () => {
    const linked = new Set(['asha']);
    expect(canOpenCopy({ ownerId: 'me', itemId: 'i1' }, 'me', linked)).toBe(true);
    expect(canOpenCopy({ ownerId: 'asha', itemId: 'i2' }, 'me', linked)).toBe(true);
    expect(canOpenCopy({ ownerId: 'zoya', itemId: 'i3' }, 'me', linked)).toBe(false);
    expect(canOpenCopy({ ownerId: 'me', itemId: '' }, 'me', linked)).toBe(false);
  });

  it('allows a copy I have right now even if I do not have the owner saved', () => {
    const linked = new Set<string>();
    const l = { ownerId: 'zoya', itemId: 'i3', borrowerUid: 'me' };
    expect(canOpenCopy({ ...l, status: 'active' }, 'me', linked)).toBe(true);
    expect(canOpenCopy({ ...l, status: 'returnPending' }, 'me', linked)).toBe(true);
    expect(canOpenCopy({ ...l, status: 'returned' }, 'me', linked)).toBe(false);
  });
});

describe('QA B1/B2 rows', () => {
  it('the borrower row says the owner hasn’t got it back, with the full short name', () => {
    const l = asBorrower({ status: 'active', dueDate: ts(day(10)), notBackYetAt: ts(day(-1)) });
    expect(openRowLine(l, 'me', 'Dr. Mehta', NOW).text).toBe(
      'Dr. Mehta hasn’t got it back yet · due 1 Dec'
    );
  });
});

describe('QA B16: a request cancelled because the copy was deleted', () => {
  it('says so in Recent on both sides', () => {
    const owner = loan({ status: 'cancelled', closedReason: 'copyRemoved' });
    expect(recentLine(owner, 'me', 'Kabir Shah')).toBe('Request cancelled · copy removed');
    const mine = asBorrower({ status: 'cancelled', closedReason: 'copyRemoved' });
    expect(recentLine(mine, 'me', 'Asha Rao')).toBe('Asha removed the book');
  });
});
