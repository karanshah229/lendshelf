import {
  catalogueSearchUrl,
  parseCatalogueResults,
  searchCatalogue,
} from '@/features/discover/catalogue';

describe('catalogueSearchUrl', () => {
  it('encodes the query and requests only the needed fields', () => {
    expect(catalogueSearchUrl('  the hobbit & co ')).toBe(
      'https://openlibrary.org/search.json?q=the%20hobbit%20%26%20co&fields=key,title,author_name,cover_i,first_publish_year,isbn&limit=20'
    );
  });
});

describe('parseCatalogueResults', () => {
  it('maps works and skips junk', () => {
    const results = parseCatalogueResults({
      docs: [
        {
          key: '/works/OL45804W',
          title: 'Fantastic Mr Fox',
          author_name: ['Roald Dahl', 'Roald Dahl'],
          cover_i: 6498519,
          first_publish_year: 1970,
          isbn: ['0140328726', '9780140328721'],
        },
        { key: '/works/OL45804W', title: 'Duplicate' },
        { key: '/books/OL1M', title: 'An edition, not a work' },
        { key: '/works/OL2W' },
        { key: '/works/OL3W', title: 'Bare', cover_i: -1 },
        null,
      ],
    });
    expect(results).toEqual([
      {
        olWorkKey: 'OL45804W',
        workId: 'ol_OL45804W',
        title: 'Fantastic Mr Fox',
        authors: ['Roald Dahl'],
        coverUrl: 'https://covers.openlibrary.org/b/id/6498519-M.jpg',
        firstPublishYear: 1970,
        isbn: '9780140328721',
      },
      {
        olWorkKey: 'OL3W',
        workId: 'ol_OL3W',
        title: 'Bare',
        authors: [],
        coverUrl: null,
        firstPublishYear: null,
        isbn: null,
      },
    ]);
  });

  it('handles unexpected shapes', () => {
    expect(parseCatalogueResults(null)).toEqual([]);
    expect(parseCatalogueResults({ docs: 'nope' })).toEqual([]);
  });
});

describe('searchCatalogue', () => {
  it('fetches and parses', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ docs: [{ key: '/works/OL1W', title: 'One' }] }),
    })) as unknown as typeof fetch;
    const res = await searchCatalogue('one', undefined, fetchImpl);
    expect(res.map((r) => r.workId)).toEqual(['ol_OL1W']);
  });

  it('throws on HTTP errors', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    await expect(searchCatalogue('x', undefined, fetchImpl)).rejects.toThrow('503');
  });
});
