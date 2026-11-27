import { day, loan, ts } from '@/features/loans/__fixtures__/loans';
import {
  deleteToPrivateSheet,
  hideSheet,
  makePrivateSheet,
  moveToPrivateSheet,
  notLendingSheet,
  pendingRequestsEffect,
  requestersToDecline,
  requestsOnItems,
} from '@/features/shelves/pending-requests';

const shared = (visibility: 'lendable' | 'visible' | 'hidden') => ({
  visibility,
  shared: visibility !== 'hidden',
});

describe('pendingRequestsEffect (E9, R11)', () => {
  it('declines when the copy disappears for requesters: hide, private collection', () => {
    expect(pendingRequestsEffect(shared('lendable'), shared('hidden'), 2)).toBe('decline');
    expect(pendingRequestsEffect(shared('visible'), shared('hidden'), 1)).toBe('decline');
    // Moved into a private collection: still lendable, but no longer shared.
    expect(
      pendingRequestsEffect(shared('lendable'), { visibility: 'lendable', shared: false }, 1)
    ).toBe('decline');
  });

  it('asks (Decline or Keep) when it becomes Not lending', () => {
    expect(pendingRequestsEffect(shared('lendable'), shared('visible'), 1)).toBe('ask');
  });

  it('does nothing without requests or when nothing is taken away', () => {
    expect(pendingRequestsEffect(shared('lendable'), shared('hidden'), 0)).toBe('none');
    expect(pendingRequestsEffect(shared('visible'), shared('lendable'), 3)).toBe('none');
    expect(pendingRequestsEffect(shared('hidden'), shared('lendable'), 3)).toBe('none');
    // Between public collections.
    expect(pendingRequestsEffect(shared('lendable'), shared('lendable'), 3)).toBe('none');
  });
});

describe('who gets declined', () => {
  const ravi = loan(
    { status: 'requested', itemId: 'af', borrowerName: 'Ravi', requestedAt: ts(day(-1)) },
    'p-ravi'
  );
  const kabir = loan(
    {
      status: 'requested',
      itemId: 'af',
      borrowerUid: 'kabir',
      borrowerName: 'Kabir',
      requestedAt: ts(day(-3)),
    },
    'p-kabir'
  );
  const dune = loan(
    { status: 'requested', itemId: 'dune', borrowerName: 'Zoya', title: 'Dune' },
    'p-dune'
  );
  const answered = loan({ status: 'declined', itemId: 'af' }, 'p-old');

  it('lists open requests on the given copies, oldest first', () => {
    expect(requestsOnItems([ravi, kabir, dune, answered], ['af']).map((l) => l.id)).toEqual([
      'p-kabir',
      'p-ravi',
    ]);
    expect(requestsOnItems([ravi, kabir, dune], ['af', 'dune'])).toHaveLength(3);
    expect(requestsOnItems([ravi], [])).toEqual([]);
  });

  it('names each requester with the name I know them by', () => {
    const names: Record<string, string> = { 'p-ravi': 'Ravi Menon', 'p-kabir': 'Kabir Singh' };
    expect(requestersToDecline([kabir, ravi], (l) => names[l.id]!)).toEqual([
      { loanId: 'p-kabir', name: 'Kabir Singh', title: kabir.title },
      { loanId: 'p-ravi', name: 'Ravi Menon', title: ravi.title },
    ]);
  });
});

describe('sheet wording', () => {
  it('hide names everyone and has no Keep', () => {
    const c = hideSheet('Animal Farm', ['Ravi Menon', 'Kabir Singh']);
    expect(c).toEqual({
      title: 'Hide “Animal Farm”?',
      description:
        'Hiding “Animal Farm” declines requests from Ravi and Kabir. They’ll be told you’re not lending it.',
      confirm: 'Hide and decline',
    });
    expect(c.keep).toBeUndefined();
    expect(hideSheet('Dune', ['Ravi Menon']).description).toBe(
      'Hiding “Dune” declines Ravi’s request. They’ll be told you’re not lending it.'
    );
  });

  it('move to a private collection', () => {
    expect(moveToPrivateSheet('Animal Farm', 'Private', ['Ravi']).description).toBe(
      'Private is a private collection. Moving “Animal Farm” there declines Ravi’s request. They’ll be told you’re not lending it.'
    );
  });

  it('make a collection private names each person with their book', () => {
    const c = makePrivateSheet('Fiction', 12, [
      { name: 'Ravi Menon', title: 'Animal Farm' },
      { name: 'Kabir', title: 'Dune' },
    ]);
    expect(c.description).toBe(
      '12 books will be hidden from people who have your number saved. Requests from Ravi (Animal Farm) and Kabir (Dune) will be declined.'
    );
    expect(c.confirm).toBe('Make private and decline');
    expect(makePrivateSheet('Fiction', 1, [{ name: 'Ravi', title: 'Dune' }]).description).toBe(
      '1 book will be hidden from people who have your number saved. The request from Ravi (Dune) will be declined.'
    );
  });

  it('delete a shared collection into a private one names each person (E9, QA E)', () => {
    const c = deleteToPrivateSheet('Fiction', 'Private', [{ name: 'Asha Rao', title: 'Dune' }]);
    expect(c.title).toBe('Delete Fiction?');
    expect(c.description).toBe(
      'Its books move to Private, which is private, so people who have your number saved won’t see them any more. The request from Asha (Dune) will be declined.'
    );
    expect(c.confirm).toBe('Delete and decline');
  });

  it('Not lending keeps the choice, Decline first', () => {
    expect(notLendingSheet(['Ravi Menon'])).toMatchObject({
      title: 'Ravi asked for this. Decline their request too?',
      confirm: 'Decline request',
      keep: 'Keep request',
    });
    expect(notLendingSheet(['Ravi', 'Kabir'])).toMatchObject({
      title: 'Ravi and Kabir asked for this. Decline their requests too?',
      confirm: 'Decline requests',
      keep: 'Keep requests',
    });
  });
});
