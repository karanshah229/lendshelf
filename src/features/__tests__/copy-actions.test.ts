import {
  deriveCopyState,
  openBorrowLoanFor,
  type CopyActionItem,
} from '@/features/copy/copy-actions';

const item = (over: Partial<CopyActionItem> = {}): CopyActionItem => ({
  id: 'i1',
  ownerId: 'owner',
  visibility: 'lendable',
  loanState: 'available',
  dueDate: null,
  activeLoanId: null,
  ...over,
});

const base = { uid: 'me', myBorrowerLoans: [], watchingBack: false, hasOwnerPhone: true };

describe('deriveCopyState — owner', () => {
  it('can lend and delete an available copy', () => {
    const s = deriveCopyState({ ...base, item: item({ ownerId: 'me' }) });
    expect(s).toMatchObject({
      role: 'owner',
      canLend: true,
      canDelete: true,
      returnLoanId: null,
      deleteBlockedReason: null,
    });
  });

  it('marks returned instead of lending, and blocks delete, while lent', () => {
    const s = deriveCopyState({
      ...base,
      item: item({ ownerId: 'me', loanState: 'lent', activeLoanId: 'L1' }),
    });
    expect(s).toMatchObject({
      role: 'owner',
      canLend: false,
      canDelete: false,
      returnLoanId: 'L1',
    });
    if (s.role === 'owner') expect(s.deleteBlockedReason).toMatch(/returned/);
  });
});

describe('deriveCopyState — viewer', () => {
  it('can ask for an available, lendable copy', () => {
    const s = deriveCopyState({ ...base, item: item() });
    expect(s).toMatchObject({
      role: 'viewer',
      canAsk: true,
      askBlockedReason: null,
      canNotifyBack: false,
      canMessage: true,
    });
    expect(s.status.kind).toBe('available');
  });

  it('shows my open request and blocks asking again', () => {
    const s = deriveCopyState({
      ...base,
      item: item(),
      myBorrowerLoans: [
        { id: 'old', itemId: 'i1', status: 'declined' },
        { id: 'other', itemId: 'i2', status: 'requested' },
        { id: 'L2', itemId: 'i1', status: 'requested' },
      ],
    });
    expect(s.status.kind).toBe('requested');
    if (s.role !== 'viewer') throw new Error('expected viewer');
    expect(s.myRequest?.id).toBe('L2');
    expect(s.canAsk).toBe(false);
    expect(s.askBlockedReason).toMatch(/already asked/);
  });

  it('offers "notify me when back" when lent to someone else', () => {
    const s = deriveCopyState({
      ...base,
      watchingBack: true,
      item: item({ loanState: 'lent', activeLoanId: 'L9' }),
    });
    expect(s).toMatchObject({
      role: 'viewer',
      canAsk: false,
      canNotifyBack: true,
      watchingBack: true,
    });
  });

  it('knows when I am the borrower', () => {
    const s = deriveCopyState({
      ...base,
      item: item({ loanState: 'lent', activeLoanId: 'L3' }),
      myBorrowerLoans: [{ id: 'L3', itemId: 'i1', status: 'active' }],
    });
    if (s.role !== 'viewer') throw new Error('expected viewer');
    expect(s.myBorrow?.id).toBe('L3');
    expect(s.canNotifyBack).toBe(false);
    expect(s.askBlockedReason).toMatch(/have this copy/);
  });

  it('does not offer asking for visible-only copies, and no WhatsApp without a number', () => {
    const s = deriveCopyState({
      ...base,
      hasOwnerPhone: false,
      item: item({ visibility: 'visible' }),
    });
    expect(s).toMatchObject({ role: 'viewer', canAsk: false, canMessage: false });
    expect(s.status.kind).toBe('notLendable');
  });
});

describe('deriveCopyState — borrowed by me', () => {
  it('shows the copy I have as "with me"', () => {
    const s = deriveCopyState({
      ...base,
      item: item({ loanState: 'lent', activeLoanId: 'L1' }),
      myBorrowerLoans: [{ id: 'L1', itemId: 'i1', status: 'active' }],
    });
    expect(s.status).toEqual({ kind: 'lent', dueDate: null, withMe: true });
  });

  it('shows a hidden copy to its owner as hidden', () => {
    const s = deriveCopyState({ ...base, item: item({ ownerId: 'me', visibility: 'hidden' }) });
    expect(s.status.kind).toBe('hidden');
  });
});

describe('openBorrowLoanFor', () => {
  const loans = [
    { id: 'L3', itemId: 'i1', status: 'returned' as const },
    { id: 'L2', itemId: 'i2', status: 'active' as const },
    { id: 'L1', itemId: 'i1', status: 'returnPending' as const },
    { id: 'L0', itemId: 'i1', status: 'active' as const },
  ];

  it('finds my newest open (active / return pending) loan of the copy', () => {
    expect(openBorrowLoanFor('i1', loans)?.id).toBe('L1');
    expect(openBorrowLoanFor('i2', loans)?.id).toBe('L2');
  });

  it('ignores requests and closed loans', () => {
    expect(
      openBorrowLoanFor('i9', [
        { id: 'a', itemId: 'i9', status: 'requested' as const },
        { id: 'b', itemId: 'i9', status: 'returned' as const },
      ])
    ).toBeNull();
    expect(openBorrowLoanFor(undefined, loans)).toBeNull();
  });
});
