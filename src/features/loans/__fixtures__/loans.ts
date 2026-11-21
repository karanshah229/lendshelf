import type { Loan, LoanStatus, WithId } from '@/types/model';

export const ts = (d: Date) => ({
  seconds: Math.floor(d.getTime() / 1000),
  nanoseconds: 0,
  toDate: () => d,
  toMillis: () => d.getTime(),
});

/** Saturday 21 Nov 2026, 12:00 local. */
export const NOW = new Date(2026, 10, 21, 12, 0);
export const day = (offset: number) => new Date(2026, 10, 21 + offset, 12, 0);
export const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

let n = 0;
/** A loan where "me" is the owner and Ravi the borrower, unless overridden. */
export function loan(
  partial: Partial<Loan> & { status: LoanStatus },
  id = `l${++n}`
): WithId<Loan> {
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

/** A loan where Asha is the owner and "me" the borrower. */
export const asBorrower = (p: Partial<Loan> & { status: LoanStatus }, id?: string) =>
  loan({ ownerId: 'asha', ownerName: 'Asha', borrowerUid: 'me', borrowerName: 'Me', ...p }, id);
