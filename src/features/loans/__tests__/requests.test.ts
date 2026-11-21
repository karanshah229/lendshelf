import { asBorrower, day, hoursAgo, loan, NOW, ts } from '@/features/loans/__fixtures__/loans';
import { declinedMessage, wentElsewhereMessage } from '@/features/loans/messages';
import { cardLoans, needsYou, needsYouBadge, otherAcceptedKey } from '@/features/loans/needs-you';
import {
  acceptAlreadyDone,
  acceptDeclinesWarning,
  askConflict,
  askConflictText,
  backAroundFor,
  DECLINE_REASONS,
  declinedLine,
  existingRequestFor,
  lendDeclinesWarning,
  otherOpenRequestsAfterAccept,
  otherRequestsForCopy,
} from '@/features/loans/requests';

jest.mock('react-native', () => ({ Linking: { openURL: jest.fn() } }));
jest.mock('@/lib/toast', () => ({ toast: { error: jest.fn() } }));

describe('decline reasons (E5 owner sheet, E4 borrower wording)', () => {
  it('offers the three reasons in order', () => {
    expect(DECLINE_REASONS.map((r) => r.label)).toEqual([
      'I’m reading it',
      'Not lending this one',
      'Lent to someone else',
    ]);
  });

  it('reads by reason, greeting the owner by first name', () => {
    expect(declinedLine('readingIt', 'Ravi Menon')).toBe('Ravi is reading it right now');
    expect(declinedLine('notLending', 'Ravi Menon')).toBe('Ravi isn’t lending it at the moment');
    expect(declinedLine(null, 'Ravi Menon')).toBe('Ravi can’t lend it right now');
    expect(declinedLine(undefined, 'Ravi')).toBe('Ravi can’t lend it right now');
  });

  it('lent to someone else: never who; the date only when the copy is visible', () => {
    expect(declinedLine('lentToSomeoneElse', 'Ravi', { backAround: day(21), now: NOW })).toBe(
      'Lent to someone else · back around 12 Dec'
    );
    expect(declinedLine('lentToSomeoneElse', 'Ravi', { backAround: null })).toBe(
      'Lent to someone else'
    );
  });

  it('prefills the WhatsApp text with the reason', () => {
    expect(
      declinedMessage({ borrowerName: 'Zoya Khan', title: 'Animal Farm', reason: 'readingIt' })
    ).toBe("Hi Zoya! Sorry, I'm reading “Animal Farm” myself right now.");
    expect(declinedMessage({ borrowerName: null, title: 'Dune', reason: 'notLending' })).toBe(
      "Hi! Sorry, I'm not lending “Dune” at the moment."
    );
    expect(
      declinedMessage({ borrowerName: 'Zoya', title: 'Dune', reason: 'lentToSomeoneElse' })
    ).toBe('Hi Zoya! Sorry, “Dune” just went to someone else.');
    expect(declinedMessage({ borrowerName: 'Zoya', title: 'Dune' })).toBe(
      "Hi Zoya! Sorry, I can't lend “Dune” right now."
    );
  });

  it('tells the other requester it went elsewhere, with the due date', () => {
    expect(
      wentElsewhereMessage({
        borrowerName: 'Kabir Singh',
        title: 'Animal Farm',
        backAround: day(21),
      })
    ).toBe(
      'Hi Kabir! Sorry, “Animal Farm” just went to someone else. It should be back around 12 Dec.'
    );
    expect(wentElsewhereMessage({ borrowerName: null, title: 'Animal Farm' })).toBe(
      'Hi! Sorry, “Animal Farm” just went to someone else.'
    );
  });
});

describe('backAroundFor', () => {
  const lent = { loanState: 'lent', dueDate: ts(day(21)), activeLoanId: 'theirs' };
  it('is the copy due date while it is out with someone else', () => {
    expect(backAroundFor(lent, new Set(['mine']))).toEqual(day(21));
  });
  it('is unknown when the copy is unreadable, available, or now lent to me', () => {
    expect(backAroundFor(null, new Set())).toBeNull();
    expect(backAroundFor({ ...lent, loanState: 'available' }, new Set())).toBeNull();
    expect(backAroundFor(lent, new Set(['theirs']))).toBeNull();
  });
});

describe('two requests for one copy (owner, E5/E7)', () => {
  const asha = loan(
    { status: 'requested', itemId: 'af', borrowerUid: 'asha', requestedAt: ts(day(-1)) },
    'r-asha'
  );
  const kabir = loan(
    { status: 'requested', itemId: 'af', borrowerUid: 'kabir', requestedAt: ts(day(-2)) },
    'r-kabir'
  );
  const other = loan({ status: 'requested', itemId: 'dune' }, 'r-dune');
  const done = loan({ status: 'declined', itemId: 'af' }, 'r-old');

  it('finds the other open requests for the same copy, oldest first', () => {
    expect(otherRequestsForCopy(asha, [asha, kabir, other, done]).map((l) => l.id)).toEqual([
      'r-kabir',
    ]);
    expect(otherRequestsForCopy(other, [asha, kabir, other])).toEqual([]);
  });

  it('warns in the due-date sheet, naming who is declined', () => {
    expect(acceptDeclinesWarning([])).toBeNull();
    expect(acceptDeclinesWarning(['Kabir Singh'])).toBe(
      'Kabir’s request will be declined. They’ll be told it went to someone else, and we’ll tell them when it’s back.'
    );
    expect(acceptDeclinesWarning(['Kabir', 'Zoya Khan'])).toMatch(
      /^Requests from Kabir and Zoya will be declined\./
    );
  });

  it('warns on the Lend screen', () => {
    expect(lendDeclinesWarning([])).toBeNull();
    expect(lendDeclinesWarning(['Kabir Singh'])).toBe(
      'Kabir asked for this. Their request will be declined.'
    );
    expect(lendDeclinesWarning(['Kabir', 'Zoya', 'Ravi'])).toBe(
      'Kabir, Zoya and Ravi asked for this. Their requests will be declined.'
    );
  });
});

describe('R14: another request accepted (borrower)', () => {
  // I asked Asha (accepted) and Kabir (still open) for the same Book.
  const accepted = asBorrower(
    {
      status: 'active',
      itemId: 'sapiens-asha',
      workId: 'w-sapiens',
      requestedAt: ts(day(-2)),
      startedAt: ts(hoursAgo(2)),
      dueDate: ts(day(21)),
    },
    'acc'
  );
  const open = asBorrower(
    {
      status: 'requested',
      itemId: 'sapiens-kabir',
      workId: 'w-sapiens',
      ownerId: 'kabir',
      ownerName: 'Kabir',
      requestedAt: ts(day(-1)),
    },
    'open'
  );
  const otherBook = asBorrower(
    { status: 'requested', itemId: 'dune', workId: 'w-dune', requestedAt: ts(day(-1)) },
    'dune'
  );

  it('pairs my still-open request with the accepted one for the same Book', () => {
    const pairs = otherOpenRequestsAfterAccept('me', [accepted, open, otherBook]);
    expect(pairs.map((p) => [p.request.id, p.accepted.id])).toEqual([['open', 'acc']]);
  });

  it('ignores loans recorded by hand, closed requests and the same copy', () => {
    const recorded = { ...accepted, requestedAt: null };
    expect(otherOpenRequestsAfterAccept('me', [recorded, open])).toEqual([]);
    expect(
      otherOpenRequestsAfterAccept('me', [accepted, { ...open, status: 'cancelled' }])
    ).toEqual([]);
    expect(
      otherOpenRequestsAfterAccept('me', [accepted, { ...open, itemId: 'sapiens-asha' }])
    ).toEqual([]);
  });

  it('is a Needs-you card (counted in the badge) until cancelled or "Keep both"', () => {
    const cards = needsYou('me', [], [accepted, open], NOW);
    const r14 = cards.find((c) => c.kind === 'otherAccepted');
    expect(r14).toMatchObject({ key: otherAcceptedKey('open') });
    expect(r14 && cardLoans(r14).map((l) => l.id)).toEqual(['open', 'acc']);
    // The accepted loan is also in its pick-up window: two cards, both counted.
    expect(needsYouBadge(cards)).toBe(2);

    const kept = needsYou('me', [], [accepted, open], NOW, {
      dismissed: new Set([otherAcceptedKey('open')]),
    });
    expect(kept.some((c) => c.kind === 'otherAccepted')).toBe(false);
  });

  it('replaces the "request expiring" card for that request', () => {
    const expiring = { ...open, requestedAt: ts(day(-6)) };
    const cards = needsYou('me', [], [accepted, expiring], NOW);
    expect(cards.filter((c) => cardLoans(c)[0]!.id === 'open').map((c) => c.kind)).toEqual([
      'otherAccepted',
    ]);
  });
});

describe('Ask sheet warning (R14)', () => {
  const requested = asBorrower(
    { status: 'requested', itemId: 'sapiens-kabir', workId: 'w-sapiens', ownerName: 'Kabir' },
    'q1'
  );
  const borrowing = asBorrower(
    { status: 'active', itemId: 'sapiens-zoya', workId: 'w-sapiens', ownerName: 'Zoya' },
    'q2'
  );

  it('warns about an open request or a loan of the same Book from someone else', () => {
    const target = { itemId: 'sapiens-asha', workId: 'w-sapiens' };
    expect(askConflict(target, 'me', [requested])).toMatchObject({ kind: 'requested' });
    // A book I already have beats a request.
    expect(askConflict(target, 'me', [requested, borrowing])).toMatchObject({
      kind: 'borrowing',
      loan: { id: 'q2' },
    });
  });

  it('stays quiet for other Books, the same copy, closed loans or an unknown Book', () => {
    expect(askConflict({ itemId: 'x', workId: 'w-dune' }, 'me', [requested])).toBeNull();
    expect(
      askConflict({ itemId: 'sapiens-kabir', workId: 'w-sapiens' }, 'me', [requested])
    ).toBeNull();
    expect(
      askConflict({ itemId: 'x', workId: 'w-sapiens' }, 'me', [
        { ...requested, status: 'declined' },
      ])
    ).toBeNull();
    expect(askConflict({ itemId: 'x', workId: undefined }, 'me', [requested])).toBeNull();
  });

  it('wording', () => {
    expect(askConflictText('requested', 'Kabir Singh')).toBe(
      'You’ve already asked Kabir for this. If Kabir says yes too, you can cancel one.'
    );
    expect(askConflictText('borrowing', 'Zoya')).toBe('You already have this book from Zoya.');
  });
});

describe('retries after a lost response (E4, E5)', () => {
  it('requestLoan already-exists: finds my open request for that copy', () => {
    const mine = asBorrower({ status: 'requested', itemId: 'af' }, 'mine');
    const closed = asBorrower({ status: 'declined', itemId: 'af' }, 'closed');
    expect(existingRequestFor('af', 'me', [closed, mine])?.id).toBe('mine');
    expect(existingRequestFor('dune', 'me', [closed, mine])).toBeNull();
  });

  it('accept: counts as done when the loan is already active', () => {
    expect(acceptAlreadyDone({ status: 'active' })).toBe(true);
    expect(acceptAlreadyDone({ status: 'returnPending' })).toBe(true);
    expect(acceptAlreadyDone({ status: 'requested' })).toBe(false);
    expect(acceptAlreadyDone({ status: 'expired' })).toBe(false);
    expect(acceptAlreadyDone(null)).toBe(false);
  });
});
