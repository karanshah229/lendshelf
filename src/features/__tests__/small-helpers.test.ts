import { cleanDescription } from '@/features/book/description';
import { editionSummary, formatLabel, languageName } from '@/features/copy/edition';
import { countByOwner, popularInCircle } from '@/features/discover/highlights';
import { groupItemsByShelf } from '@/features/person/group-by-shelf';
import {
  isRating,
  ratingDistribution,
  reviewFields,
  starFills,
  validateReview,
} from '@/features/reviews/review-logic';
import { capitalize, initials, joinNames } from '@/features/shared/people';
import { wishlistAvailability } from '@/features/wishlist/availability';
import type { CopySummary } from '@/features/book/circle-copies';

describe('edition', () => {
  it('labels formats and languages', () => {
    expect(formatLabel('hardcover')).toBe('Hardcover');
    expect(formatLabel(null)).toBeNull();
    expect(languageName('en')).toBe('English');
    expect(languageName('eng')).toBe('English');
    expect(languageName('Marathi')).toBe('Marathi');
    expect(languageName('xx')).toBe('XX');
    expect(languageName('  ')).toBeNull();
    expect(editionSummary({ format: 'paperback', language: 'hi' })).toBe('Paperback · Hindi');
    expect(editionSummary({ format: null, language: null })).toBeNull();
  });
});

describe('cleanDescription', () => {
  it('strips markdown links, source notes and the footer', () => {
    const raw =
      'A **great** [story](https://x.y) about foxes ([source][1]).\r\n\r\n----------\nAlso contained in:\n- [Other](https://a)\n\n[1]: https://src';
    expect(cleanDescription(raw)).toBe('A great story about foxes.');
    expect(cleanDescription('   ')).toBeNull();
    expect(cleanDescription(null)).toBeNull();
  });
});

describe('popularInCircle', () => {
  const c = (id: string, workId: string, ownerId: string, title = workId) => ({
    id,
    workId,
    ownerId,
    title,
    authors: [],
  });
  it('ranks by distinct owners and needs at least two', () => {
    const res = popularInCircle([
      c('1', 'a', 'x'),
      c('2', 'a', 'x'),
      c('3', 'b', 'x'),
      c('4', 'b', 'y'),
      c('5', 'b', 'z'),
      c('6', 'c', 'x', 'Alpha'),
      c('7', 'c', 'y', 'Alpha'),
      c('8', 'd', 'y', 'Beta'),
      c('9', 'd', 'z', 'Beta'),
    ]);
    expect(res.map((r) => [r.workId, r.ownerCount])).toEqual([
      ['b', 3],
      ['c', 2],
      ['d', 2],
    ]);
    expect(popularInCircle([c('1', 'a', 'x')], { minOwners: 1, limit: 1 })).toHaveLength(1);
  });

  it('counts copies per owner', () => {
    expect([...countByOwner([{ ownerId: 'a' }, { ownerId: 'a' }, { ownerId: 'b' }])]).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
});

describe('groupItemsByShelf', () => {
  it('follows shelf order, sorts by title, skips empty shelves and collects the rest', () => {
    const groups = groupItemsByShelf(
      [
        { id: 's1', name: 'Fiction' },
        { id: 's2', name: 'Empty' },
        { id: 's3', name: 'Kids' },
      ],
      [
        { id: 'a', shelfId: 's3', title: 'Matilda' },
        { id: 'b', shelfId: 's1', title: 'Zorba' },
        { id: 'c', shelfId: 's1', title: 'Atonement' },
        { id: 'd', shelfId: 'gone', title: 'Lost' },
      ]
    );
    expect(groups.map((g) => [g.name, g.items.map((i) => i.id)])).toEqual([
      ['Fiction', ['c', 'b']],
      ['Kids', ['a']],
      [null, ['d']],
    ]);
  });
});

describe('review logic', () => {
  it('validates', () => {
    expect(validateReview(0, '')).toMatch(/star/);
    expect(validateReview(3.5, '')).toMatch(/star/);
    expect(validateReview(4, 'x'.repeat(2001))).toMatch(/2000/);
    expect(validateReview(5, '  great  ')).toBeNull();
    expect(isRating(5)).toBe(true);
  });

  it('builds the document fields', () => {
    expect(
      reviewFields({ workId: 'w', uid: 'u', authorName: '  Asha ', rating: 4, text: '   ' })
    ).toEqual({ workId: 'w', authorId: 'u', authorName: 'Asha', rating: 4, text: null });
    expect(
      reviewFields({ workId: 'w', uid: 'u', authorName: '', rating: 2, text: ' ok ' })
    ).toMatchObject({ authorName: 'Reader', text: 'ok' });
  });

  it('summarises ratings', () => {
    expect(ratingDistribution([{ rating: 5 }, { rating: 5 }, { rating: 1 }])).toEqual([
      1, 0, 0, 0, 2,
    ]);
    expect(starFills(3.6)).toEqual([1, 1, 1, 0.5, 0]);
    expect(starFills(4.8)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(0)).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('people', () => {
  it('makes initials', () => {
    expect(initials('Asha Rao')).toBe('AR');
    expect(initials('kabir')).toBe('K');
    expect(initials('Meera  K  Iyer')).toBe('MI');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });

  it('joins names', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Asha'])).toBe('Asha');
    expect(joinNames(['Asha', 'Ravi'])).toBe('Asha and Ravi');
    expect(joinNames(['Asha', 'Ravi', 'Meera'])).toBe('Asha, Ravi and Meera');
    expect(joinNames(['Asha', 'Ravi', 'Meera', 'Kabir'])).toBe('Asha, Ravi and 2 others');
    expect(capitalize('back today')).toBe('Back today');
  });
});

describe('wishlistAvailability', () => {
  const names: Record<string, string> = { r: 'Ravi', m: 'Meera' };
  const nameOf = (id: string) => names[id] ?? 'Someone';
  const summary = (over: Partial<CopySummary>): CopySummary => ({
    othersCount: 0,
    availableCount: 0,
    mineCount: 0,
    bestStatus: null,
    ownerIds: [],
    availableOwnerIds: [],
    ...over,
  });
  const now = new Date(2026, 10, 21);

  it('prefers available copies', () => {
    const a = wishlistAvailability(
      summary({
        othersCount: 2,
        availableCount: 1,
        ownerIds: ['r', 'm'],
        availableOwnerIds: ['r'],
        bestStatus: { kind: 'available' },
      }),
      nameOf,
      now
    );
    expect(a).toEqual({ tone: 'available', text: 'Available from Ravi', rank: 0 });
  });

  it('describes lent copies with the return date', () => {
    const a = wishlistAvailability(
      summary({
        othersCount: 1,
        ownerIds: ['m'],
        bestStatus: { kind: 'lent', dueDate: new Date(2026, 11, 12) },
      }),
      nameOf,
      now
    );
    expect(a.text).toBe('Meera has it · lent out, back 12 Dec');
    expect(a.tone).toBe('lent');
  });

  it('falls back to mine / nobody', () => {
    expect(wishlistAvailability(summary({ mineCount: 1 }), nameOf, now).tone).toBe('mine');
    expect(wishlistAvailability(summary({}), nameOf, now)).toMatchObject({ tone: 'none', rank: 3 });
  });
});
