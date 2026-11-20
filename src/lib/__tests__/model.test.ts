import { routeForNotification } from '@/lib/notification-routes';
import {
  buildNewItem,
  defaultShelfId,
  isSharedWithContacts,
  itemStatus,
  reviewId,
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
    expect(routeForNotification({ type: 'loanRequested', loanId: 'l1' })).toBe('/loans');
    expect(routeForNotification({ type: 'itemBack', itemId: 'i1' })).toEqual({
      pathname: '/copy/[itemId]',
      params: { itemId: 'i1' },
    });
    expect(routeForNotification({ type: 'wishlistAdded', itemId: 'i1', workId: 'w1' })).toEqual({
      pathname: '/copy/[itemId]',
      params: { itemId: 'i1' },
    });
    expect(routeForNotification({ type: 'reviewPrompt', workId: 'w1', loanId: 'l1' })).toEqual({
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
});
