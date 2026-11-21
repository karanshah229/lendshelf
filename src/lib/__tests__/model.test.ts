import { hrefFromPath, routeForNotification } from '@/lib/notification-routes';
import {
  buildNewItem,
  defaultShelfId,
  fromQuerySnap,
  fromSnap,
  isSharedWithContacts,
  itemStatus,
  reviewId,
  toStringList,
  watchId,
} from '@/types/model';

describe('model helpers', () => {
  it('ids', () => {
    expect(defaultShelfId('u1')).toBe('default_u1');
    expect(reviewId('ol_OL1W', 'u1')).toBe('ol_OL1W_u1');
    expect(watchId('u1', 'back', 'item9')).toBe('u1_back_item9');
  });

  it('isSharedWithContacts', () => {
    expect(isSharedWithContacts(true, 'lendable')).toBe(true);
    expect(isSharedWithContacts(true, 'visible')).toBe(true);
    expect(isSharedWithContacts(true, 'hidden')).toBe(false);
    expect(isSharedWithContacts(false, 'lendable')).toBe(false);
  });

  it('buildNewItem writes exactly the 18 item fields with backend defaults', () => {
    const now = { sentinel: true };
    const item = buildNewItem(
      {
        ownerId: 'u1',
        workId: 'ol_OL1W',
        shelfId: 'default_u1',
        shelfIsPublic: true,
        visibility: 'hidden',
        title: 'Dune',
        authors: ['Frank Herbert'],
        coverUrl: null,
        isCustom: false,
        isbn: '9780441013593',
        format: 'paperback',
        language: 'en',
      },
      now
    );
    expect(Object.keys(item).sort()).toEqual(
      [
        'activeLoanId',
        'authors',
        'category',
        'coverUrl',
        'createdAt',
        'dueDate',
        'format',
        'isCustom',
        'isbn',
        'language',
        'loanState',
        'ownerId',
        'shelfId',
        'sharedWithContacts',
        'title',
        'updatedAt',
        'visibility',
        'workId',
      ].sort()
    );
    expect(item).toMatchObject({
      category: 'book',
      loanState: 'available',
      dueDate: null,
      activeLoanId: null,
      sharedWithContacts: false,
      createdAt: now,
      updatedAt: now,
    });
  });

  it('itemStatus', () => {
    const due = new Date(2026, 11, 12);
    const ts = { seconds: 0, nanoseconds: 0, toDate: () => due, toMillis: () => due.getTime() };
    expect(itemStatus({ loanState: 'lent', dueDate: ts, visibility: 'lendable' })).toEqual({
      kind: 'lent',
      dueDate: due,
    });
    expect(
      itemStatus(
        { loanState: 'available', dueDate: null, visibility: 'lendable' },
        { requestedByMe: true }
      )
    ).toEqual({
      kind: 'requested',
    });
    expect(itemStatus({ loanState: 'available', dueDate: null, visibility: 'visible' })).toEqual({
      kind: 'notLendable',
    });
    expect(itemStatus({ loanState: 'available', dueDate: null, visibility: 'lendable' })).toEqual({
      kind: 'available',
    });
  });
});

describe('routeForNotification', () => {
  it('routes by payload', () => {
    const loanHref = { pathname: '/loan/[loanId]', params: { loanId: 'l1' } };
    for (const type of [
      'loanRequested',
      'requestAccepted',
      'requestDeclined',
      'requestExpired',
      'lentToYou',
      'markedReturned',
      'dueSoon',
      'overdue',
      'itemRemoved',
      'notBackYet',
      'dueChanged',
      'ownerLeft',
    ]) {
      expect(routeForNotification({ type, loanId: 'l1' })).toEqual(loanHref);
    }
    expect(routeForNotification({ type: 'availableAgain', itemId: 'i1' })).toEqual({
      pathname: '/copy/[itemId]',
      params: { itemId: 'i1' },
    });
    expect(routeForNotification({ type: 'itemBack', itemId: 'i1' })).toEqual({
      pathname: '/copy/[itemId]',
      params: { itemId: 'i1' },
    });
    expect(routeForNotification({ type: 'wishlistAdded', itemId: 'i1', workId: 'w1' })).toEqual({
      pathname: '/copy/[itemId]',
      params: { itemId: 'i1' },
    });
    expect(routeForNotification({ type: 'reviewPrompt', workId: 'w1', loanId: 'l1' })).toEqual({
      pathname: '/loan/[loanId]',
      params: { loanId: 'l1', review: '1' },
    });
    expect(routeForNotification({ type: 'reviewPrompt', workId: 'w1' })).toEqual({
      pathname: '/review/[workId]',
      params: { workId: 'w1' },
    });
    expect(routeForNotification({ workId: 'w1' })).toEqual({
      pathname: '/book/[workId]',
      params: { workId: 'w1' },
    });
    expect(routeForNotification(null)).toBeNull();
    expect(routeForNotification({ type: 'x' })).toBeNull();
  });

  it('turns link paths into detail screens to keep through sign-in', () => {
    expect(hrefFromPath('loan/abc')).toEqual({
      pathname: '/loan/[loanId]',
      params: { loanId: 'abc' },
    });
    expect(hrefFromPath('/copy/i1?x=1')).toEqual({
      pathname: '/copy/[itemId]',
      params: { itemId: 'i1' },
    });
    expect(hrefFromPath('book/ol_1/')).toEqual({
      pathname: '/book/[workId]',
      params: { workId: 'ol_1' },
    });
    expect(hrefFromPath('person/u1')).toEqual({ pathname: '/person/[uid]', params: { uid: 'u1' } });
    expect(hrefFromPath('loans')).toBeNull();
    expect(hrefFromPath('')).toBeNull();
    expect(hrefFromPath(null)).toBeNull();
  });
});

describe('defensive document reads', () => {
  const snap = (id: string, data: unknown) => ({ id, exists: () => true, data: () => data });

  it('toStringList keeps only strings', () => {
    expect(toStringList(['a', 1, null, 'b', { x: 1 }, undefined])).toEqual(['a', 'b']);
    expect(toStringList('Jane Austen')).toEqual([]);
    expect(toStringList(undefined)).toEqual([]);
  });

  it('fromSnap / fromQuerySnap coerce authors (items, works) to string[]', () => {
    const item = fromSnap<{ title: string; authors: string[] }>(
      snap('i1', { title: 'Dune', authors: ['Frank Herbert', 42, null] })
    );
    expect(item).toEqual({ id: 'i1', title: 'Dune', authors: ['Frank Herbert'] });
    const works = fromQuerySnap<{ authors: string[] }>({
      docs: [snap('w1', { authors: 'Frank Herbert' }), snap('w2', { authors: null })],
    });
    expect(works.map((w) => w.authors)).toEqual([[], []]);
  });

  it('leaves documents without authors untouched', () => {
    expect(fromSnap(snap('p1', { name: 'Asha' }))).toEqual({ id: 'p1', name: 'Asha' });
    expect(fromSnap({ id: 'x', exists: () => false, data: () => undefined })).toBeNull();
  });
});

describe('itemStatus: hidden and borrowed by me', () => {
  const due = new Date(2026, 11, 12);
  const ts = { seconds: 0, nanoseconds: 0, toDate: () => due, toMillis: () => due.getTime() };

  it('a hidden copy reads as hidden (owner only), not "not lendable"', () => {
    expect(itemStatus({ loanState: 'available', dueDate: null, visibility: 'hidden' })).toEqual({
      kind: 'hidden',
    });
  });

  it('a copy I am borrowing is lent "with me"', () => {
    expect(
      itemStatus({ loanState: 'lent', dueDate: ts, visibility: 'lendable' }, { borrowedByMe: true })
    ).toEqual({ kind: 'lent', dueDate: due, withMe: true });
  });
});
