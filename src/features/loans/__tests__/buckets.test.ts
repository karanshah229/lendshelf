import {
  bucketLoans,
  canOpenCopy,
  closedStatusLabel,
  initialSegment,
  requestDaysLeft,
} from '@/features/loans/buckets';
import type { Loan, LoanStatus, WithId } from '@/types/model';

const ts = (d: Date) => ({
  seconds: Math.floor(d.getTime() / 1000),
  nanoseconds: 0,
  toDate: () => d,
  toMillis: () => d.getTime(),
});

const NOW = new Date(2026, 10, 21, 12, 0);
const day = (offset: number) => new Date(2026, 10, 21 + offset, 12, 0);

let n = 0;
function loan(partial: Partial<Loan> & { status: LoanStatus }, id = `l${++n}`): WithId<Loan> {
  return {
    id,
    itemId: `item-${id}`,
    workId: 'ol_1',
    ownerId: 'me',
    ownerName: 'Me',
    ownerPhone: '+919000000001',
    borrowerUid: 'ravi',
    borrowerName: 'Ravi',
    borrowerPhone: '+919000000002',
    title: `Book ${id}`,
    coverUrl: null,
    message: null,
    dueDate: null,
    requestedAt: null,
    startedAt: null,
    returnMarkedAt: null,
    returnedAt: null,
    updatedAt: ts(NOW),
    ...partial,
  };
}

const asBorrower = (p: Partial<Loan> & { status: LoanStatus }, id?: string) =>
  loan({ ownerId: 'asha', ownerName: 'Asha', borrowerUid: 'me', ...p }, id);

describe('bucketLoans', () => {
  it('splits loans into requests, lent, borrowed and history', () => {
    const owner = [
      loan({ status: 'requested', requestedAt: ts(day(-1)) }, 'in1'),
      loan({ status: 'active', dueDate: ts(day(5)) }, 'lent1'),
      loan({ status: 'returnPending', dueDate: ts(day(10)) }, 'lent2'),
      loan({ status: 'returned', returnedAt: ts(day(-3)) }, 'hist-lent'),
      loan({ status: 'declined', updatedAt: ts(day(-2)) }, 'hist-req1'),
    ];
    const borrower = [
      asBorrower({ status: 'requested', requestedAt: ts(day(-1)) }, 'out1'),
      asBorrower({ status: 'active', dueDate: ts(day(2)) }, 'bor1'),
      asBorrower({ status: 'returned', returnedAt: ts(day(-5)) }, 'hist-bor'),
      asBorrower({ status: 'expired', updatedAt: ts(day(-1)) }, 'hist-req2'),
    ];
    const b = bucketLoans('me', owner, borrower);
    expect(b.incoming.map((l) => l.id)).toEqual(['in1']);
    expect(b.outgoing.map((l) => l.id)).toEqual(['out1']);
    expect(b.lent.map((l) => l.id)).toEqual(['lent2', 'lent1']); // "says returned" first
    expect(b.borrowed.map((l) => l.id)).toEqual(['bor1']);
    expect(b.history.lent.map((l) => l.id)).toEqual(['hist-lent']);
    expect(b.history.borrowed.map((l) => l.id)).toEqual(['hist-bor']);
    expect(b.history.requests.map((l) => l.id)).toEqual(['hist-req2', 'hist-req1']);
    expect(b.counts).toEqual({ requests: 2, lent: 2, borrowed: 1 });
  });

  it('orders incoming requests oldest first and outgoing newest first', () => {
    const b = bucketLoans(
      'me',
      [
        loan({ status: 'requested', requestedAt: ts(day(-1)) }, 'new'),
        loan({ status: 'requested', requestedAt: ts(day(-5)) }, 'old'),
      ],
      [
        asBorrower({ status: 'requested', requestedAt: ts(day(-5)) }, 'o-old'),
        asBorrower({ status: 'requested', requestedAt: ts(day(-1)) }, 'o-new'),
      ]
    );
    expect(b.incoming.map((l) => l.id)).toEqual(['old', 'new']);
    expect(b.outgoing.map((l) => l.id)).toEqual(['o-new', 'o-old']);
  });

  it('sorts lent and borrowed by due date, undated last, borrowed return-pending last', () => {
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
      ]
    );
    expect(b.lent.map((l) => l.id)).toEqual(['overdue', 'later', 'none']);
    expect(b.borrowed.map((l) => l.id)).toEqual(['b-active', 'b-pending']);
  });

  it('ignores duplicates and loans that are not mine', () => {
    const shared = loan({ status: 'active' }, 'dup');
    const strangers = loan({ status: 'active', ownerId: 'x', borrowerUid: 'y' }, 'other');
    const b = bucketLoans('me', [shared, strangers], [shared]);
    expect(b.lent.map((l) => l.id)).toEqual(['dup']);
    expect(b.borrowed).toEqual([]);
  });
});

describe('initialSegment', () => {
  const empty = { requests: 0, lent: 0, borrowed: 0 };
  it('opens Requests when something waits for me', () => {
    expect(initialSegment({ incoming: [loan({ status: 'requested' })], counts: empty })).toBe(
      'requests'
    );
  });
  it('otherwise the first non-empty segment', () => {
    expect(initialSegment({ incoming: [], counts: { ...empty, lent: 1 } })).toBe('lent');
    expect(initialSegment({ incoming: [], counts: { ...empty, borrowed: 2 } })).toBe('borrowed');
    expect(initialSegment({ incoming: [], counts: empty })).toBe('requests');
  });
});

describe('requestDaysLeft', () => {
  it('counts down from 7 days after the request', () => {
    expect(requestDaysLeft({ requestedAt: ts(day(0)) }, NOW)).toBe(7);
    expect(requestDaysLeft({ requestedAt: ts(day(-6)) }, NOW)).toBe(1);
    expect(requestDaysLeft({ requestedAt: ts(day(-9)) }, NOW)).toBe(0);
    expect(requestDaysLeft({ requestedAt: null }, NOW)).toBeNull();
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
});

describe('closedStatusLabel', () => {
  it('labels closed statuses', () => {
    expect(closedStatusLabel('returned')).toBe('Returned');
    expect(closedStatusLabel('expired')).toBe('Expired');
  });
});
