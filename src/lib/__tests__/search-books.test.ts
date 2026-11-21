import {
  bookKey,
  groupByBook,
  isDerivativeRecord,
  isExactCatalogueMatch,
  likelyCatalogueMatches,
  mainTitle,
  rankCatalogueResults,
  searchBooks,
} from '@/lib/search';

type Copy = { id: string; workId: string; title: string; authors: string[] };

describe('bookKey / groupByBook', () => {
  it('matches the same title + first author across work ids, ignoring case and accents', () => {
    expect(bookKey('Sapiens', ['Yuval Noah Harari'])).toBe(
      bookKey('  SAPIENS ', ['yuval noah harari', 'Someone Else'])
    );
    expect(bookKey('Cien años', ['García'])).toBe(bookKey('Cien anos', ['Garcia']));
    expect(bookKey('Sapiens', ['Yuval Noah Harari'])).not.toBe(bookKey('Sapiens', ['Other']));
    expect(bookKey(undefined, 'not-a-list')).toBe('|');
  });

  it('puts the work with most copies first', () => {
    const copies: Copy[] = [
      { id: '1', workId: 'custom_1', title: 'Sapiens', authors: ['Yuval Noah Harari'] },
      { id: '2', workId: 'ol_1', title: 'Sapiens', authors: ['Yuval Noah Harari'] },
      { id: '3', workId: 'ol_1', title: 'sapiens', authors: ['Yuval Noah Harari'] },
      { id: '4', workId: 'ol_2', title: 'Dune', authors: ['Frank Herbert'] },
    ];
    const groups = groupByBook(copies);
    expect(groups.map((g) => [g.workId, g.workIds, g.copies.length])).toEqual([
      ['ol_1', ['ol_1', 'custom_1'], 3],
      ['ol_2', ['ol_2'], 1],
    ]);
  });
});

describe('searchBooks', () => {
  const copies: Copy[] = [
    { id: '1', workId: 'ol_A', title: 'Sapiens', authors: ['Yuval Noah Harari'] },
    { id: '2', workId: 'ol_B', title: 'Sapiens', authors: ['Yuval Noah Harari'] },
    { id: '3', workId: 'ol_C', title: 'Sapiens', authors: ['Someone Else'] },
    { id: '4', workId: 'ol_D', title: 'Dune', authors: ['Frank Herbert'] },
  ];

  it('groups editions filed under different works into one result ("2 editions")', () => {
    const res = searchBooks(copies, 'sapiens');
    expect(res).toHaveLength(2);
    const harari = res.find((g) => g.authors[0] === 'Yuval Noah Harari')!;
    expect(harari.workIds).toEqual(['ol_A', 'ol_B']);
    expect(harari.copies.map((c) => c.id)).toEqual(['1', '2']);
  });

  it('returns everything sorted by title for an empty query', () => {
    expect(searchBooks(copies, ' ').map((g) => g.title)).toEqual(['Dune', 'Sapiens', 'Sapiens']);
  });
});

// Shapes taken from Open Library's search.json for "sapiens harari".
const SAPIENS = [
  {
    title: 'Summary of Sapiens by Yuval Noah Harari',
    authors: ['FlashBooks Book Summaries'],
    editionCount: 1,
  },
  { title: 'Sapiens', authors: ['Yuval Noah Harari'], editionCount: 1 },
  { title: 'ההיסטוריה של המחר', authors: ['Yuval Noah Harari'], editionCount: 39 },
  { title: 'Summary : Sapiens', authors: ['Noah Fran'], editionCount: 1 },
  { title: 'Sapiens', authors: ['Yuval Noah Harari'], editionCount: 86 },
  { title: 'Sapiens/Homo Deus box set', authors: ['Yuval Noah Harari'], editionCount: 1 },
  {
    title: 'Key Takeaways, Analysis & Review of Yuval Noah Harari’s Sapiens',
    authors: ['Eureka Books'],
    editionCount: 1,
  },
  { title: 'Resumo de Sapiens', authors: ['Sapiens Editorial'], editionCount: 1 },
];

describe('rankCatalogueResults', () => {
  it('lists the main record first and summaries last for "sapiens harari"', () => {
    const ranked = rankCatalogueResults(SAPIENS, 'sapiens harari');
    expect(ranked[0]).toMatchObject({ title: 'Sapiens', editionCount: 86 });
    expect(ranked[1]).toMatchObject({ title: 'Sapiens', editionCount: 1 });
    const firstDerivative = ranked.findIndex((r) => isDerivativeRecord(r));
    expect(ranked.slice(firstDerivative).every((r) => isDerivativeRecord(r))).toBe(true);
    expect(ranked.slice(firstDerivative).map((r) => r.title)).toEqual([
      'Summary of Sapiens by Yuval Noah Harari',
      'Summary : Sapiens',
      'Key Takeaways, Analysis & Review of Yuval Noah Harari’s Sapiens',
      'Resumo de Sapiens',
    ]);
  });

  it('keeps the catalogue order for non-exact matches', () => {
    const ranked = rankCatalogueResults(
      [
        { title: 'Moral Thinking Fast and Slow', authors: ['Hanno Sauer'] },
        { title: 'Summary of Thinking, Fast and Slow', authors: ['Instaread Summaries'] },
        { title: 'Thinking, Fast and Slow', authors: ['Daniel Kahneman'], editionCount: 36 },
      ],
      'thinking fast'
    );
    expect(ranked.map((r) => r.title)).toEqual([
      'Moral Thinking Fast and Slow',
      'Thinking, Fast and Slow',
      'Summary of Thinking, Fast and Slow',
    ]);
  });
});

describe('derivative and exact-match detection', () => {
  it('spots summaries, guides and books "by" someone else', () => {
    expect(isDerivativeRecord({ title: 'Atomic Habits Workbook', authors: ['James Clear'] })).toBe(
      true
    );
    expect(
      isDerivativeRecord({
        title: 'Thinking Fast and Slow by Daniel Kahneman',
        authors: ['Gloria J. Russell'],
      })
    ).toBe(true);
    expect(isDerivativeRecord({ title: 'Stand by Me', authors: ['Stephen King'] })).toBe(false);
    expect(isDerivativeRecord({ title: 'Atomic Habits', authors: ['James Clear'] })).toBe(false);
    expect(isDerivativeRecord({ title: 'Anything', authors: ['Instaread'] })).toBe(true);
  });

  it('needs the whole main title in the query and every query word in title or author', () => {
    expect(mainTitle('Sapiens: A Brief History of Humankind')).toBe('sapiens');
    expect(
      isExactCatalogueMatch(
        { title: 'Sapiens: A Brief History', authors: ['Yuval Noah Harari'] },
        'sapiens harari'
      )
    ).toBe(true);
    expect(
      isExactCatalogueMatch(
        { title: 'Sapiens/Homo Deus box set', authors: ['Yuval Noah Harari'] },
        'sapiens harari'
      )
    ).toBe(false);
    expect(
      isExactCatalogueMatch({ title: 'Sapiens', authors: ['Someone'] }, 'sapiens harari')
    ).toBe(false);
    expect(isExactCatalogueMatch({ title: 'Sapiens', authors: [] }, '  ')).toBe(false);
  });
});

describe('likelyCatalogueMatches', () => {
  it('offers same-title records, matching author first, never summaries', () => {
    const matches = likelyCatalogueMatches(SAPIENS, {
      title: 'Sapiens: A Brief History of Humankind',
      authors: ['Harari'],
    });
    expect(matches.map((m) => [m.title, m.editionCount])).toEqual([
      ['Sapiens', 86],
      ['Sapiens', 1],
    ]);
  });

  it('finds nothing for a title the catalogue does not have', () => {
    expect(
      likelyCatalogueMatches(SAPIENS, { title: "Nani's Recipe Notebook", authors: [] })
    ).toEqual([]);
    expect(likelyCatalogueMatches(SAPIENS, { title: '  ', authors: [] })).toEqual([]);
  });
});
