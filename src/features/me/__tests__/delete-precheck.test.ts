import { asBorrower, loan } from '@/features/loans/__fixtures__/loans';
import {
  deletePrecheck,
  hasLoanImpact,
  openRequestsLine,
  outWithFriendsLine,
} from '@/features/me/delete-precheck';

describe('deletePrecheck', () => {
  it('lists books out with friends, non-app loans, books I have and open requests', () => {
    const owner = [
      loan({ status: 'active', title: 'Animal Farm', borrowerName: 'Asha' }, 'af'),
      loan({ status: 'returnPending', title: 'The Martian' }, 'tm'),
      loan({ status: 'active', borrowerUid: null, borrowerName: 'Nikhil' }, 'non-app'),
      loan({ status: 'requested' }, 'req-in'),
      loan({ status: 'returned' }, 'done'),
    ];
    const borrower = [
      asBorrower({ status: 'active', title: 'Atomic Habits' }, 'ah'),
      asBorrower({ status: 'requested' }, 'req-out'),
      asBorrower({ status: 'declined' }, 'old'),
    ];
    const p = deletePrecheck('me', owner, borrower);
    expect(p.outWithFriends.map((l) => l.id)).toEqual(['af', 'tm']);
    expect(p.lentToNonApp.map((l) => l.id)).toEqual(['non-app']);
    expect(p.borrowing.map((l) => l.id)).toEqual(['ah']);
    expect(p.openRequests).toBe(2);
    expect(hasLoanImpact(p)).toBe(true);
    expect(hasLoanImpact(deletePrecheck('me', [owner[4]!], []))).toBe(false);
  });

  it('words the lines for one or many', () => {
    expect(outWithFriendsLine(1)).toMatch(/^1 book is out with friends\./);
    expect(outWithFriendsLine(2)).toMatch(/^2 books are out with friends\./);
    expect(openRequestsLine(1)).toBe('Your 1 open request will be cancelled.');
    expect(openRequestsLine(2)).toBe('Your 2 open requests will be cancelled.');
  });
});
