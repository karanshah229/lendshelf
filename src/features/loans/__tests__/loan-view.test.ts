import { asBorrower, day, hoursAgo, loan, NOW, ts } from '@/features/loans/__fixtures__/loans';
import { actionLabel, loanPhase, loanTimeline, loanView } from '@/features/loans/loan-view';
import type { Loan } from '@/types/model';

const asOwner = (l: Loan, hasPhone = true) =>
  loanView({ loan: l, uid: 'me', other: 'Asha Rao', otherHasPhone: hasPhone, now: NOW });
const asBor = (l: Loan, extra: Partial<Parameters<typeof loanView>[0]> = {}) =>
  loanView({ loan: l, uid: 'me', other: 'Ravi Menon', otherHasPhone: true, now: NOW, ...extra });

const pickupFields = {
  status: 'active' as const,
  requestedAt: ts(day(-1)),
  startedAt: ts(hoursAgo(3)),
  dueDate: ts(day(21)),
};

describe('loanPhase', () => {
  it('derives the phase from status, reasons, the pick-up window and the due date', () => {
    expect(loanPhase(loan(pickupFields), NOW)).toBe('pickup');
    expect(loanPhase(loan({ status: 'active', dueDate: ts(day(10)) }), NOW)).toBe('reading');
    expect(loanPhase(loan({ status: 'active', dueDate: ts(day(1)) }), NOW)).toBe('dueSoon');
    expect(loanPhase(loan({ status: 'active', dueDate: ts(day(-2)) }), NOW)).toBe('overdue');
    expect(loanPhase(loan({ status: 'cancelled', closedReason: 'notCollected' }), NOW)).toBe(
      'notCollected'
    );
    expect(loanPhase(loan({ status: 'cancelled' }), NOW)).toBe('cancelled');
    expect(loanPhase(loan({ status: 'ownerLeft' }), NOW)).toBe('ownerLeft');
  });
});

describe('loanView: owner', () => {
  it('requested: Accept is P, Decline S; Message stays on the other-party row', () => {
    const v = asOwner(loan({ status: 'requested', requestedAt: ts(day(-2)) }));
    expect(v.banner.title).toBe('Asha wants to borrow it');
    expect(v.banner.detail).toBe('Expires in 5 days');
    expect([v.primary, v.secondary, v.tertiary]).toEqual(['accept', ['decline'], []]);
  });

  it('pick-up window: "Waiting for Asha to pick up", P Message Asha, no nudge, T Not collected', () => {
    const v = asOwner(loan(pickupFields));
    expect(v.banner.title).toBe('Waiting for Asha to pick up');
    expect(v.primary).toBe('message');
    expect(actionLabel(v.primary!, v, 'Asha Rao')).toBe('Message Asha');
    expect([...v.secondary, ...v.tertiary]).not.toContain('nudge');
    expect(v.tertiary).toContain('notCollected');
  });

  it('reading: no P; Got it back and Nudge as S; no Not collected after the pick-up window (QA B10)', () => {
    const v = asOwner(
      loan({
        status: 'active',
        dueDate: ts(day(10)),
        requestedAt: ts(day(-12)),
        startedAt: ts(day(-11)),
      })
    );
    expect(v.primary).toBeNull();
    expect(v.secondary).toEqual(['gotItBack', 'nudge']);
    // "Change" is on the due row, so the banner doesn't repeat it; Not collected is window-only.
    expect(v.tertiary).toEqual([]);
    const overdue = asOwner(
      loan({ status: 'active', dueDate: ts(day(-3)), requestedAt: ts(day(-30)), startedAt: ts(day(-24)) })
    );
    expect(overdue.tertiary).not.toContain('notCollected');
  });

  it('overdue: words not colour, P Nudge on WhatsApp; without a phone Got it back is P', () => {
    const l = loan({ status: 'active', dueDate: ts(day(-3)), startedAt: ts(day(-24)) });
    const v = asOwner(l);
    expect(v.banner).toMatchObject({ title: '3 days overdue', tone: 'danger' });
    expect(v.primary).toBe('nudge');
    expect(actionLabel('nudge', v, 'Asha')).toBe('Nudge on WhatsApp');
    expect(v.secondary).toEqual(['gotItBack']);
    const noPhone = asOwner(l, false);
    expect(noPhone.primary).toBe('gotItBack');
    expect(noPhone.secondary).toEqual([]);
  });

  it('says returned: P Got it back, S Not back yet', () => {
    const v = asOwner(loan({ status: 'returnPending' }));
    expect(v.banner.title).toBe('Asha says it’s back');
    expect([v.primary, v.secondary]).toEqual(['gotItBack', ['notBackYet']]);
  });

  it('closed states have no actions', () => {
    for (const l of [
      loan({ status: 'returned', returnedAt: ts(day(-1)) }),
      loan({ status: 'cancelled', closedReason: 'notCollected' }),
      loan({ status: 'declined' }),
      loan({ status: 'cancelled' }),
    ]) {
      const v = asOwner(l);
      expect(v.closed).toBe(true);
      expect([v.primary, v.secondary, v.tertiary, v.showReview]).toEqual([null, [], [], false]);
    }
    expect(asOwner(loan({ status: 'cancelled', closedReason: 'notCollected' })).banner.title).toBe(
      'Not collected'
    );
  });

  it('expired, or past 7 days before the daily job: closed, P Message (E5, QA B3/B14)', () => {
    for (const l of [
      loan({ status: 'expired' }),
      loan({ status: 'requested', requestedAt: ts(day(-8)) }),
    ]) {
      const v = asOwner(l);
      expect(v.closed).toBe(true);
      expect(v.banner.title).toBe('Request expired');
      expect(v.primary).toBe('message');
      expect(v.secondary).toEqual([]);
    }
  });
});

describe('loanView: borrower', () => {
  it('requested: P Message Ravi again, S Cancel', () => {
    const v = asBor(asBorrower({ status: 'requested', requestedAt: ts(day(-1)) }));
    expect(v.banner).toMatchObject({
      title: 'Request sent',
      detail: 'Ravi can answer in LendShelf · expires in 6 days',
    });
    expect([v.primary, v.secondary]).toEqual(['message', ['cancelRequest']]);
    expect(actionLabel('message', v, 'Ravi Menon')).toBe('Message Ravi again');
  });

  it('pick-up window: "Pick up from Ravi" with the pickup note, P Message Ravi', () => {
    const v = asBor(asBorrower(pickupFields), { pickupNote: 'Koramangala, weekends' });
    expect(v.banner).toMatchObject({
      title: 'Pick up from Ravi',
      detail: 'Ravi said yes · pickup: Koramangala, weekends',
    });
    expect([v.primary, v.secondary]).toEqual(['message', []]);
  });

  it('pick-up window: a book picked up and given back within 48 h can be marked returned (QA Android #6)', () => {
    const v = asBor(asBorrower(pickupFields));
    expect(v.tertiary).toEqual(['notPickingUp', 'markReturned']);
    // Without the owner's number there's nothing to message, but returning still works.
    const noPhone = asBor(asBorrower(pickupFields), { otherHasPhone: false });
    expect([noPhone.primary, noPhone.tertiary]).toEqual([null, ['markReturned']]);
  });

  it('after 48 h the wording switches to "With you"', () => {
    const l = asBorrower({ ...pickupFields, startedAt: ts(hoursAgo(50)) });
    expect(asBor(l).banner.title).toBe('With you');
  });

  it('reading / due soon / overdue: P I’ve returned it, S Ask for more time', () => {
    for (const due of [day(10), day(1), day(-2)]) {
      const v = asBor(asBorrower({ status: 'active', dueDate: ts(due), startedAt: ts(day(-20)) }));
      expect([v.primary, v.secondary]).toEqual(['markReturned', ['askMoreTime']]);
    }
    expect(asBor(asBorrower({ status: 'active', dueDate: ts(day(-2)) })).banner.title).toBe(
      '2 days overdue'
    );
  });

  it('return pending: waiting for the owner', () => {
    const v = asBor(asBorrower({ status: 'returnPending' }));
    expect(v.banner.title).toBe('Waiting for Ravi to confirm');
    expect(v.primary).toBe('message');
  });

  it('returned shows "How was it?"; not collected and owner left do not', () => {
    expect(asBor(asBorrower({ status: 'returned' })).showReview).toBe(true);
    expect(
      asBor(asBorrower({ status: 'cancelled', closedReason: 'notCollected' })).showReview
    ).toBe(false);
    expect(asBor(asBorrower({ status: 'ownerLeft' })).showReview).toBe(false);
  });

  it('owner left: the banner text from the spec, no actions', () => {
    const v = asBor(asBorrower({ status: 'ownerLeft', title: 'Animal Farm' }), {
      other: 'Ravi',
      otherHasPhone: false,
    });
    expect(v.banner.title).toBe('Ravi left LendShelf');
    expect(`${v.banner.title}. ${v.banner.detail}`).toBe(
      'Ravi left LendShelf. If you still have Animal Farm, message them on WhatsApp if you still have their number.'
    );
    expect(v.primary).toBeNull();
  });

  it('declined: reason text; P Add to wishlist except for lent to someone else', () => {
    const reading = asBor(asBorrower({ status: 'declined', declineReason: 'readingIt' }));
    expect(reading.banner.detail).toBe('Ravi is reading it right now.');
    expect(reading.primary).toBe('addToWishlist');
    const elsewhere = asBor(
      asBorrower({ status: 'declined', declineReason: 'lentToSomeoneElse' }),
      {
        backAround: day(21),
      }
    );
    expect(elsewhere.banner).toMatchObject({
      title: 'Lent to someone else · back around 12 Dec',
      detail: 'We’ll tell you when it’s back.',
    });
    expect(elsewhere.primary).toBeNull();
    expect(elsewhere.secondary).toEqual([]);
  });

  it('lent to someone else: no date when the copy is unreadable; Turn off / Notify me', () => {
    const l = asBorrower({ status: 'declined', declineReason: 'lentToSomeoneElse' });
    const watching = asBor(l, { watchingBack: true });
    expect(watching.banner.title).toBe('Lent to someone else');
    expect(watching.secondary).toEqual(['stopNotify']);
    expect(actionLabel('stopNotify', watching, 'Ravi')).toBe('Turn off “Notify me”');
    const off = asBor(l, { watchingBack: false });
    expect(off.banner.detail).toBe('Notify me is off.');
    expect(off.secondary).toEqual(['notifyMe']);
    expect(actionLabel('notifyMe', off, 'Ravi')).toBe('Notify me when it’s back');
  });

  it('declined without a reason or not lending', () => {
    expect(asBor(asBorrower({ status: 'declined' })).banner.detail).toBe(
      'Ravi can’t lend it right now.'
    );
    expect(
      asBor(asBorrower({ status: 'declined', declineReason: 'notLending' })).banner.detail
    ).toBe('Ravi isn’t lending it at the moment.');
  });

  it('expired: Ask again', () => {
    expect(asBor(asBorrower({ status: 'expired' })).primary).toBe('askAgain');
  });

  it('hides WhatsApp actions without a number', () => {
    const v = asBor(asBorrower({ status: 'requested', requestedAt: ts(day(-1)) }), {
      otherHasPhone: false,
    });
    expect(v.primary).toBeNull();
  });
});

describe('loanTimeline', () => {
  it('keeps every returned / not back yet from returnEvents (QA Android #10)', () => {
    const l = asBorrower({
      status: 'returned',
      requestedAt: ts(day(-20)),
      startedAt: ts(day(-19)),
      dueDate: ts(day(2)),
      returnMarkedAt: ts(day(-2)),
      notBackYetAt: null,
      returnedAt: ts(day(-1)),
      returnEvents: [
        { kind: 'returnMarked', at: ts(day(-4)) },
        { kind: 'notBackYet', at: ts(day(-3)) },
        { kind: 'returnMarked', at: ts(day(-2)) },
      ],
    });
    const borrower = loanTimeline(l, 'me', 'Ravi Menon');
    expect(borrower.map((e) => e.label)).toEqual([
      'You asked',
      'Accepted (due 23 Nov)',
      'You said you returned it',
      'Ravi hasn’t got it back yet',
      'You said you returned it',
      'Confirmed back',
    ]);
    expect(new Set(borrower.map((e) => e.key)).size).toBe(borrower.length);
    expect(loanTimeline({ ...l, ownerId: 'me' }, 'me', 'Asha').map((e) => e.label)).toEqual([
      'Asha asked',
      'Accepted (due 23 Nov)',
      'Asha said it’s back',
      'You said it’s not back yet',
      'Asha said it’s back',
      'Confirmed back',
    ]);
  });

  it('lists asked, accepted (with due), returned and confirmed', () => {
    const l = asBorrower({
      status: 'returned',
      requestedAt: ts(day(-20)),
      startedAt: ts(day(-19)),
      dueDate: ts(day(2)),
      returnMarkedAt: ts(day(-2)),
      returnedAt: ts(day(-1)),
    });
    expect(loanTimeline(l, 'me', 'Ravi').map((e) => e.label)).toEqual([
      'You asked',
      'Accepted (due 23 Nov)',
      'You said you returned it',
      'Confirmed back',
    ]);
  });

  it('says how a request or loan ended', () => {
    const nc = loan({
      status: 'cancelled',
      closedReason: 'notCollected',
      requestedAt: ts(day(-3)),
      startedAt: ts(day(-3)),
    });
    expect(loanTimeline(nc, 'me', 'Asha').map((e) => e.label)).toEqual([
      'Asha asked',
      'Accepted',
      'Closed: not collected',
    ]);
    const byHand = loan({ status: 'active', startedAt: ts(day(-3)) });
    expect(loanTimeline(byHand, 'me', 'Nikhil').map((e) => e.label)).toEqual(['Lent to Nikhil']);
  });
});

describe('QA fixes', () => {
  it('B1: after "Not back yet" the borrower sees it, with P Message Ravi and S I’ve returned it', () => {
    const l = asBorrower({
      status: 'active',
      requestedAt: ts(day(-20)),
      startedAt: ts(day(-19)),
      dueDate: ts(day(5)),
      notBackYetAt: ts(hoursAgo(2)),
    });
    const v = asBor(l);
    expect(v.banner).toMatchObject({ title: 'Ravi hasn’t got it back yet', tone: 'warning' });
    expect(v.banner.detail).toBe('From Ravi · due 26 Nov');
    expect([v.primary, v.secondary]).toEqual(['message', ['markReturned', 'askMoreTime']]);
    expect(actionLabel('message', v, 'Ravi Menon')).toBe('Message Ravi');
    // Without a number, I've returned it is the P.
    expect(asBor(l, { otherHasPhone: false }).primary).toBe('markReturned');
    // Overdue keeps the words.
    const late = asBor({ ...l, dueDate: ts(day(-2)) });
    expect(late.banner).toMatchObject({ tone: 'danger', detail: '2 days overdue · was due 19 Nov' });
    expect(loanTimeline(l, 'me', 'Ravi Menon').map((e) => e.label)).toEqual([
      'You asked',
      'Accepted (due 26 Nov)',
      'Ravi hasn’t got it back yet',
    ]);
    expect(loanTimeline({ ...l, ownerId: 'me' }, 'me', 'Ravi').at(-1)?.label).toBe(
      'You said it’s not back yet'
    );
  });

  it('B2: saved names that start with a title are never cut to it', () => {
    const v = asOwner(loan(pickupFields));
    const dr = loanView({
      loan: loan(pickupFields),
      uid: 'me',
      other: 'Dr. Mehta',
      otherHasPhone: true,
      now: NOW,
    });
    expect(v.banner.title).toBe('Waiting for Asha to pick up');
    expect(dr.banner.title).toBe('Waiting for Dr. Mehta to pick up');
    expect(actionLabel('message', dr, 'Dr. Mehta')).toBe('Message Dr. Mehta');
    expect(actionLabel('message', dr, 'Mrs. A. Iyer')).toBe('Message Mrs. A. Iyer');
    expect(actionLabel('message', dr, 'Kabir')).toBe('Message Kabir');
    expect(
      loanTimeline(loan({ status: 'requested', requestedAt: ts(day(-1)) }), 'me', 'Dr. Mehta')[0]
        ?.label
    ).toBe('Dr. Mehta asked');
  });

  it('B9: a due-date change keeps the first date and adds "Due date moved to …"', () => {
    const l = loan({
      status: 'active',
      requestedAt: ts(day(-5)),
      startedAt: ts(day(-4)),
      firstDueDate: ts(day(17)),
      dueDate: ts(day(24)),
      dueChangedAt: ts(day(-1)),
    });
    expect(loanTimeline(l, 'me', 'Asha').map((e) => e.label)).toEqual([
      'Asha asked',
      'Accepted (due 8 Dec)',
      'Due date moved to 15 Dec',
    ]);
  });

  it('B12: lent to someone else, but the copy is back: "It’s back on Ravi’s shelf" + Ask again', () => {
    const l = asBorrower({ status: 'declined', declineReason: 'lentToSomeoneElse' });
    const v = asBor(l, { copyAvailable: true, watchingBack: false });
    expect(v.banner.title).toBe('It’s back on Ravi’s shelf');
    expect(v.primary).toBe('askAgain');
  });

  it('B13: the owner sees "Tara left LendShelf" when the borrower deleted their account', () => {
    const l = loan({ status: 'active', borrowerUid: null, dueDate: ts(day(5)) });
    const v = loanView({
      loan: l,
      uid: 'me',
      other: 'Tara',
      otherHasPhone: true,
      borrowerLeft: true,
      now: NOW,
    });
    expect(v.banner.title).toBe('Tara left LendShelf');
    expect(v.secondary).toContain('gotItBack');
  });
});
