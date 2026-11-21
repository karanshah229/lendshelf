import { day, loan, NOW, ts } from '@/features/loans/__fixtures__/loans';
import { requestTimedOut, staleOutcome } from '@/features/loans/stale';

const owner = { role: 'owner' as const, other: 'Kabir Shah', now: NOW };
const borrower = { role: 'borrower' as const, other: 'Ravi Menon', now: NOW };

describe('staleOutcome (QA B3, E5 failure exits)', () => {
  it('owner: the requester cancelled while the sheet was open', () => {
    expect(staleOutcome('decline', loan({ status: 'cancelled' }), owner)).toEqual({
      text: 'Kabir cancelled this request',
      message: false,
    });
  });

  it('owner: expired, by status or by time, offers Message', () => {
    expect(staleOutcome('accept', loan({ status: 'expired' }), owner)).toEqual({
      text: 'This request expired',
      message: true,
    });
    const old = loan({ status: 'requested', requestedAt: ts(day(-8)) });
    expect(requestTimedOut(old, NOW)).toBe(true);
    expect(staleOutcome('accept', old, owner)).toEqual({ text: 'This request expired', message: true });
  });

  it('owner: already lent by hand meanwhile', () => {
    expect(
      staleOutcome('accept', loan({ status: 'declined', declineReason: 'lentToSomeoneElse' }), owner)
        ?.text
    ).toBe('This copy went to someone else, so Kabir’s request was declined');
  });

  it('borrower: the owner already said yes, or the loan is closed', () => {
    expect(staleOutcome('cancelRequest', loan({ status: 'active' }), borrower)?.text).toBe(
      'Ravi already said yes'
    );
    expect(staleOutcome('markReturned', loan({ status: 'returned' }), borrower)?.text).toBe(
      'This book is already back'
    );
  });

  it('a gone loan is withdrawn; a loan still in the right state is not stale', () => {
    expect(staleOutcome('decline', undefined, owner)?.text).toBe('This request was withdrawn');
    expect(
      staleOutcome('decline', loan({ status: 'requested', requestedAt: ts(day(-1)) }), owner)
    ).toBeNull();
    expect(staleOutcome('gotItBack', loan({ status: 'returnPending' }), owner)).toBeNull();
  });

  it('never shows codes', () => {
    for (const status of ['cancelled', 'expired', 'declined', 'active', 'returned', 'ownerLeft'] as const) {
      const out = staleOutcome('decline', loan({ status }), owner);
      expect(out?.text).not.toMatch(/\[|failed|precondition/);
    }
  });
});
