import { groupByWork, normaliseText, scoreWork, searchCopies, tokenize } from '@/lib/search';

type Copy = { id: string; workId: string; title: string; authors: string[]; ownerId: string };

const copies: Copy[] = [
  {
    id: 'c1',
    workId: 'w1',
    title: 'Cien años de soledad',
    authors: ['Gabriel García Márquez'],
    ownerId: 'a',
  },
  { id: 'c2', workId: 'w2', title: 'Dune', authors: ['Frank Herbert'], ownerId: 'a' },
  { id: 'c3', workId: 'w2', title: 'Dune', authors: ['Frank Herbert'], ownerId: 'b' },
  { id: 'c4', workId: 'w3', title: 'Dune Messiah', authors: ['Frank Herbert'], ownerId: 'b' },
  { id: 'c5', workId: 'w4', title: 'The Sandman', authors: ['Neil Gaiman'], ownerId: 'c' },
  { id: 'c6', workId: 'w5', title: 'Children of Dune', authors: ['Frank Herbert'], ownerId: 'c' },
  { id: 'c7', workId: 'w6', title: 'Herbert West', authors: ['H. P. Lovecraft'], ownerId: 'c' },
];

describe('normaliseText', () => {
  it('folds case, diacritics and punctuation', () => {
    expect(normaliseText('  Gabriel García-Márquez!  ')).toBe('gabriel garcia marquez');
    expect(normaliseText('Ærøskøbing')).toBe('ærøskøbing'); // letters without decompositions stay
    expect(normaliseText('Cien AÑOS')).toBe('cien anos');
    expect(tokenize('  ')).toEqual([]);
  });
});

describe('groupByWork', () => {
  it('groups copies of the same Book', () => {
    const groups = groupByWork(copies);
    expect(groups.map((g) => g.workId)).toEqual(['w1', 'w2', 'w3', 'w4', 'w5', 'w6']);
    expect(groups[1]!.copies.map((c) => c.id)).toEqual(['c2', 'c3']);
  });
});

describe('scoreWork', () => {
  it('is 0 when any token does not match', () => {
    expect(scoreWork('Dune', ['Frank Herbert'], 'dune zebra')).toBe(0);
  });

  it('ranks exact title > title prefix > title contains', () => {
    const exact = scoreWork('Dune', ['Frank Herbert'], 'dune');
    const prefix = scoreWork('Dune Messiah', ['Frank Herbert'], 'dune');
    const contains = scoreWork('Children of Dune', ['Frank Herbert'], 'dune');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(contains);
  });
});

describe('searchCopies', () => {
  it('is case and diacritics insensitive', () => {
    expect(searchCopies(copies, 'GARCIA marquez').map((g) => g.workId)).toEqual(['w1']);
    expect(searchCopies(copies, 'anos').map((g) => g.workId)).toEqual(['w1']);
  });

  it('ranks title matches and groups copies', () => {
    const results = searchCopies(copies, 'dune');
    expect(results.map((g) => g.workId)).toEqual(['w2', 'w3', 'w5']);
    expect(results[0]!.copies).toHaveLength(2);
  });

  it('matches authors, ranking title matches higher', () => {
    const results = searchCopies(copies, 'herbert');
    expect(results[0]!.workId).toBe('w6'); // "Herbert West" — title word match
    expect(results.map((g) => g.workId).sort()).toEqual(['w2', 'w3', 'w5', 'w6']);
  });

  it('matches across title and author tokens', () => {
    expect(searchCopies(copies, 'messiah herbert').map((g) => g.workId)).toEqual(['w3']);
  });

  it('matches word prefixes', () => {
    expect(searchCopies(copies, 'sand').map((g) => g.workId)).toEqual(['w4']);
  });

  it('returns every Book sorted by title for an empty query', () => {
    expect(searchCopies(copies, '  ').map((g) => g.title)).toEqual([
      'Children of Dune',
      'Cien años de soledad',
      'Dune',
      'Dune Messiah',
      'Herbert West',
      'The Sandman',
    ]);
  });
});

describe('malformed documents', () => {
  it('ignores non-string titles and authors instead of crashing', () => {
    expect(normaliseText(undefined)).toBe('');
    expect(normaliseText(42)).toBe('');
    const bad = [
      ...copies,
      // Data that slipped past the model (e.g. written before a rule existed).
      { id: 'x1', workId: 'wx', title: 7, authors: [null, 'Frank Herbert', 3], ownerId: 'z' },
      { id: 'x2', workId: 'wy', title: 'Dune Notes', authors: 'Frank Herbert', ownerId: 'z' },
    ] as unknown as Copy[];
    expect(() => searchCopies(bad, 'herbert')).not.toThrow();
    expect(() => searchCopies(bad, '')).not.toThrow();
    expect(searchCopies(bad, 'herbert').map((g) => g.workId)).toContain('wx');
    expect(scoreWork('Dune Notes', 'Frank Herbert' as unknown as string[], 'dune')).toBeGreaterThan(0);
  });
});
