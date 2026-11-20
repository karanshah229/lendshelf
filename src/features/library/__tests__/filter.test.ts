import { ALL_SHELVES, countCopies, filterCopies, ownerStatus } from '@/features/library/filter';
import type { Item } from '@/types/model';

const NOW = new Date(2026, 10, 21, 15, 30); // 21 Nov 2026

type Copy = Pick<Item, 'shelfId' | 'visibility' | 'loanState' | 'title' | 'authors' | 'workId'> & {
  id: string;
  dueDate: Date | null;
};

const copy = (id: string, over: Partial<Copy> = {}): Copy => ({
  id,
  shelfId: 's1',
  visibility: 'lendable',
  loanState: 'available',
  title: `Title ${id}`,
  authors: ['Author'],
  workId: `w${id}`,
  dueDate: null,
  ...over,
});

const items: Copy[] = [
  copy('1', { title: 'Dune', authors: ['Frank Herbert'] }),
  copy('2', { title: 'The Hobbit', authors: ['J. R. R. Tolkien'], loanState: 'lent' }),
  copy('3', { title: 'Emma', authors: ['Jane Austen'], shelfId: 's2', visibility: 'hidden' }),
  copy('4', {
    title: 'Dune Messiah',
    authors: ['Frank Herbert'],
    shelfId: 's2',
    loanState: 'lent',
  }),
];

describe('filterCopies', () => {
  const ids = (list: Copy[]) => list.map((c) => c.id);

  it('keeps everything for all shelves and no filter', () => {
    expect(ids(filterCopies(items, { shelfId: ALL_SHELVES, filter: 'all', query: '' }))).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('scopes to a shelf and quick filter', () => {
    expect(ids(filterCopies(items, { shelfId: 's2', filter: 'all', query: '' }))).toEqual([
      '3',
      '4',
    ]);
    expect(ids(filterCopies(items, { shelfId: ALL_SHELVES, filter: 'lent', query: '' }))).toEqual([
      '2',
      '4',
    ]);
    expect(ids(filterCopies(items, { shelfId: 's2', filter: 'hidden', query: '' }))).toEqual(['3']);
  });

  it('searches title and author, best match first', () => {
    expect(
      ids(filterCopies(items, { shelfId: ALL_SHELVES, filter: 'all', query: 'dune' }))
    ).toEqual(['1', '4']);
    expect(
      ids(filterCopies(items, { shelfId: ALL_SHELVES, filter: 'all', query: 'tolkien' }))
    ).toEqual(['2']);
    expect(filterCopies(items, { shelfId: 's1', filter: 'all', query: 'austen' })).toEqual([]);
  });
});

describe('countCopies', () => {
  it('counts per shelf and within the selected shelf', () => {
    expect(countCopies(items, ALL_SHELVES)).toEqual({
      all: 4,
      lent: 2,
      hidden: 1,
      byShelf: { s1: 2, s2: 2 },
    });
    expect(countCopies(items, 's1')).toMatchObject({ all: 2, lent: 1, hidden: 0 });
  });
});

describe('ownerStatus', () => {
  it('shows lent copies with their due date, overdue in red', () => {
    expect(
      ownerStatus(
        { loanState: 'lent', visibility: 'lendable', dueDate: new Date(2026, 11, 12) },
        true,
        NOW
      )
    ).toEqual({ kind: 'lent', label: 'Lent · back 12 Dec', short: 'Back 12 Dec', tone: 'lent' });
    expect(
      ownerStatus(
        { loanState: 'lent', visibility: 'hidden', dueDate: new Date(2026, 10, 18) },
        true,
        NOW
      )
    ).toMatchObject({ label: 'Lent · overdue 3 days', short: 'Overdue 3 days', tone: 'overdue' });
    expect(
      ownerStatus({ loanState: 'lent', visibility: 'lendable', dueDate: null }, true, NOW)
    ).toMatchObject({ label: 'Lent out' });
  });

  it('shows hidden, private, visible-only and available copies', () => {
    const base = { loanState: 'available' as const, dueDate: null };
    expect(ownerStatus({ ...base, visibility: 'hidden' }, true).kind).toBe('hidden');
    expect(ownerStatus({ ...base, visibility: 'lendable' }, false).kind).toBe('private');
    expect(ownerStatus({ ...base, visibility: 'visible' }, true).kind).toBe('visibleOnly');
    expect(ownerStatus({ ...base, visibility: 'lendable' }, true)).toMatchObject({
      kind: 'available',
      tone: 'success',
    });
  });
});
