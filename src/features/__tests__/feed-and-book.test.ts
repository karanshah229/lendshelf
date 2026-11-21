import { findCatalogueMatches, type OlSearchResult } from '@/features/add/open-library';
import { circleCopiesForBook } from '@/features/book/circle-copies';
import {
  availableToBorrow,
  newByPerson,
  POPULAR_MIN_ENTRIES,
  popularInCircle,
} from '@/features/discover/highlights';
import { MAIN_SHELF_NAME, shelfDisplayName } from '@/features/library/filter';
import { wishlistAvailableNow } from '@/features/wishlist/availability';
import type { TimestampLike, Visibility } from '@/types/model';

const NOW = new Date(2026, 10, 21, 10);
const DAY = 24 * 60 * 60 * 1000;

const ts = (ms: number): TimestampLike => ({
  seconds: Math.floor(ms / 1000),
  nanoseconds: 0,
  toDate: () => new Date(ms),
  toMillis: () => ms,
});

interface TestItem {
  id: string;
  ownerId: string;
  workId: string;
  title: string;
  authors: string[];
  visibility: Visibility;
  loanState: 'available' | 'lent';
  dueDate: TimestampLike | null;
  createdAt: TimestampLike;
}

const item = (id: string, over: Partial<TestItem> = {}): TestItem => ({
  id,
  ownerId: 'kabir',
  workId: `ol_${id}`,
  title: `Book ${id}`,
  authors: ['Author'],
  visibility: 'lendable',
  loanState: 'available',
  dueDate: null,
  createdAt: ts(NOW.getTime() - 30 * DAY),
  ...over,
});

describe('newByPerson', () => {
  it('groups this week’s copies by person, most recent person first', () => {
    const groups = newByPerson(
      [
        item('old', { ownerId: 'asha' }),
        item('k1', { ownerId: 'kabir', createdAt: ts(NOW.getTime() - 3 * DAY) }),
        item('k2', { ownerId: 'kabir', createdAt: ts(NOW.getTime() - 1 * DAY) }),
        item('r1', { ownerId: 'ravi', createdAt: ts(NOW.getTime() - 2 * DAY) }),
      ],
      { now: NOW }
    );
    expect(groups.map((g) => [g.ownerId, g.items.map((i) => i.id)])).toEqual([
      ['kabir', ['k2', 'k1']],
      ['ravi', ['r1']],
    ]);
  });
});

describe('availableToBorrow', () => {
  it('never repeats a book shown in New this week, even another person’s copy', () => {
    const fresh = item('dune-kabir', {
      workId: 'ol_dune',
      title: 'Dune',
      authors: ['Frank Herbert'],
      createdAt: ts(NOW.getTime() - DAY),
    });
    const network = [
      fresh,
      item('dune-ravi', {
        ownerId: 'ravi',
        workId: 'ol_dune_alt',
        title: 'DUNE',
        authors: ['Frank Herbert'],
      }),
      item('gatsby'),
      item('requested'),
      item('borrowed'),
      item('lent', { loanState: 'lent' }),
      item('notLending', { visibility: 'visible' }),
    ];
    const news = newByPerson(network, { now: NOW });
    const available = availableToBorrow(network, {
      exclude: news.flatMap((g) => g.items),
      requestedItemIds: new Set(['requested']),
      borrowedItemIds: new Set(['borrowed']),
    });
    expect(available.map((i) => i.id)).toEqual(['gatsby']);
    const newIds = new Set(news.flatMap((g) => g.items.map((i) => i.workId)));
    expect(available.some((i) => newIds.has(i.workId))).toBe(false);
  });
});

describe('popularInCircle from network copies', () => {
  const network = [
    item('a1', { ownerId: 'x', workId: 'ol_a', title: 'Alpha' }),
    item('a2', { ownerId: 'y', workId: 'ol_a', title: 'Alpha' }),
    item('b1', { ownerId: 'x', workId: 'ol_b', title: 'Beta' }),
    item('b2', { ownerId: 'y', workId: 'custom_b', title: 'beta' }), // another record, same book
    item('c1', { ownerId: 'x', workId: 'ol_c', title: 'Gamma' }),
    item('c2', { ownerId: 'z', workId: 'ol_c', title: 'Gamma' }),
  ];

  it('merges editions and leaves out books I own (by work id or title + author)', () => {
    expect(popularInCircle(network).map((p) => [p.title, p.ownerCount])).toEqual([
      ['Alpha', 2],
      ['Beta', 2],
      ['Gamma', 2],
    ]);
    const mine = [
      item('m1', { ownerId: 'me', workId: 'ol_a', title: 'Alpha' }),
      item('m2', { ownerId: 'me', workId: 'custom_mine', title: 'GAMMA' }),
    ];
    expect(popularInCircle(network, { exclude: mine }).map((p) => p.title)).toEqual(['Beta']);
  });

  it('is empty (so the section hides) when I own every popular book', () => {
    const mine = network.map((c) => ({ ...c, id: `mine-${c.id}`, ownerId: 'me' }));
    expect(popularInCircle(network, { exclude: mine })).toEqual([]);
    expect(POPULAR_MIN_ENTRIES).toBe(3);
  });
});

describe('circleCopiesForBook (Book page "Who has it")', () => {
  const asha = item('asha-sapiens', {
    ownerId: 'asha',
    workId: 'ol_A',
    title: 'Sapiens',
    authors: ['Yuval Noah Harari'],
  });
  const kabir = item('kabir-sapiens', {
    ownerId: 'kabir',
    workId: 'ol_B',
    title: 'Sapiens',
    authors: ['Yuval Noah Harari', 'Translator'],
  });
  const other = item('other-sapiens', {
    ownerId: 'ravi',
    workId: 'ol_C',
    title: 'Sapiens',
    authors: ['Someone Else'],
  });

  it('lists copies from both catalogue records on either book page', () => {
    for (const [workId, otherWorkId] of [
      ['ol_A', 'ol_B'],
      ['ol_B', 'ol_A'],
    ] as const) {
      const { others } = circleCopiesForBook(
        workId,
        { title: 'Sapiens', authors: ['Yuval Noah Harari'] },
        [asha, kabir, other],
        { uid: 'me' }
      );
      expect(others.map((c) => c.item.id).sort()).toEqual(['asha-sapiens', 'kabir-sapiens']);
      expect(others.find((c) => c.item.workId === otherWorkId)?.otherEdition).toBe(true);
      expect(others.find((c) => c.item.workId === workId)?.otherEdition).toBeUndefined();
    }
  });

  it('works before the Book is loaded, from the copies filed under it', () => {
    const { others } = circleCopiesForBook('ol_A', null, [asha, kabir], { uid: 'me' });
    expect(others).toHaveLength(2);
  });
});

describe('wishlistAvailableNow', () => {
  it('lists wishlist books someone can lend now, skipping ones I own', () => {
    const copies = [
      item('dune', { ownerId: 'ravi', workId: 'ol_dune' }),
      item('gatsby', { ownerId: 'ravi', workId: 'ol_gatsby', loanState: 'lent' }),
      item('hobbit', { ownerId: 'ravi', workId: 'ol_hobbit' }),
      item('hobbit-mine', { ownerId: 'me', workId: 'ol_hobbit' }),
    ];
    const res = wishlistAvailableNow(
      [
        { workId: 'ol_dune', title: 'Dune' },
        { workId: 'ol_gatsby', title: 'Gatsby' },
        { workId: 'ol_hobbit', title: 'Hobbit' },
        { workId: 'ol_none', title: 'Nobody has it' },
      ],
      copies,
      { uid: 'me' }
    );
    expect(res.map((r) => [r.workId, r.best.item.id])).toEqual([['ol_dune', 'dune']]);
  });

  it('skips a copy I already asked for', () => {
    const res = wishlistAvailableNow(
      [{ workId: 'ol_dune', title: 'Dune' }],
      [item('dune', { ownerId: 'ravi', workId: 'ol_dune' })],
      { uid: 'me', requestedItemIds: new Set(['dune']) }
    );
    expect(res).toEqual([]);
  });
});

describe('shelfDisplayName', () => {
  it('shows the default collection as Main shelf, display only', () => {
    expect(shelfDisplayName({ id: 'default_u1', ownerId: 'u1', name: 'My books' })).toBe(
      MAIN_SHELF_NAME
    );
    expect(shelfDisplayName({ id: 'default_u1', ownerId: 'u1', name: 'Home' })).toBe('Home');
    expect(shelfDisplayName({ id: 'shelf-2', ownerId: 'u1', name: 'My books' })).toBe('My books');
  });
});

describe('findCatalogueMatches ("Is it one of these?")', () => {
  const r = (
    workKey: string,
    title: string,
    authors: string[],
    editionCount = 1
  ): OlSearchResult => ({
    workKey,
    title,
    authors,
    coverUrl: null,
    firstPublishYear: null,
    editionCount,
  });

  it('searches title + author, then the title alone', async () => {
    const queries: string[] = [];
    const search = async (q: string) => {
      queries.push(q);
      return q === 'Sapiens'
        ? [r('OL2W', 'Summary of Sapiens', ['X']), r('OL1W', 'Sapiens', ['Yuval Noah Harari'], 86)]
        : [];
    };
    const matches = await findCatalogueMatches(
      { title: 'Sapiens', authors: ['Harrari'] },
      { search }
    );
    expect(queries).toEqual(['Sapiens Harrari', 'Sapiens']);
    expect(matches.map((m) => m.workKey)).toEqual(['OL1W']);
  });

  it('returns nothing for a blank title without searching', async () => {
    const search = jest.fn();
    expect(await findCatalogueMatches({ title: ' ', authors: [] }, { search })).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
