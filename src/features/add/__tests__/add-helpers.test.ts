import { languageName, normaliseLanguageInput } from '@/features/add/languages';
import { olCoverUrl, olSearchUrl, olWorkKey, parseOlSearch } from '@/features/add/open-library';
import { languageFor, parseAuthors } from '@/features/add/save';
import { candidateFromResolved, parseAddMode, type AddCandidate } from '@/features/add/types';

// save.ts imports the Firebase module; keep the test free of SDK setup.
jest.mock('@/lib/firebase', () => ({}));

describe('Open Library search parsing', () => {
  it('builds the search URL with the requested fields', () => {
    const url = olSearchUrl('  pride & prejudice ');
    expect(url).toContain('q=pride%20%26%20prejudice');
    expect(url).toContain(
      'fields=key,title,author_name,cover_i,first_publish_year,isbn,edition_count'
    );
    expect(url).toContain('limit=20');
  });

  it('extracts work keys and cover URLs', () => {
    expect(olWorkKey('/works/OL45804W')).toBe('OL45804W');
    expect(olWorkKey('OL45804W')).toBe('OL45804W');
    expect(olWorkKey('/books/OL1M')).toBeNull();
    expect(olCoverUrl(12345)).toBe('https://covers.openlibrary.org/b/id/12345-M.jpg');
    expect(olCoverUrl(-1)).toBeNull();
    expect(olCoverUrl(undefined)).toBeNull();
  });

  it('parses docs, skipping invalid and duplicate works', () => {
    const results = parseOlSearch({
      docs: [
        {
          key: '/works/OL1W',
          title: ' Dune ',
          author_name: ['Frank Herbert', 'Frank Herbert'],
          cover_i: 7,
          first_publish_year: 1965,
          edition_count: 120,
        },
        { key: '/works/OL1W', title: 'Dune again' },
        { key: '/works/OL2W' },
        { title: 'No key' },
        { key: '/works/OL3W', title: 'Bare' },
      ],
    });
    expect(results).toEqual([
      {
        workKey: 'OL1W',
        title: 'Dune',
        authors: ['Frank Herbert'],
        coverUrl: 'https://covers.openlibrary.org/b/id/7-M.jpg',
        firstPublishYear: 1965,
        editionCount: 120,
      },
      {
        workKey: 'OL3W',
        title: 'Bare',
        authors: [],
        coverUrl: null,
        firstPublishYear: null,
        editionCount: 0,
      },
    ]);
    expect(parseOlSearch(null)).toEqual([]);
    expect(parseOlSearch({ docs: 'nope' })).toEqual([]);
  });
});

describe('candidates', () => {
  it('prefers the edition cover and ISBN from resolveBook', () => {
    const c = candidateFromResolved({
      workId: 'ol_OL1W',
      work: {
        category: 'book',
        source: 'openlibrary',
        title: 'Dune',
        authors: ['Frank Herbert'],
        description: null,
        coverUrl: 'work.jpg',
        firstPublishYear: 1965,
        isCustom: false,
        createdBy: null,
      },
      edition: {
        isbn: '9780441013593',
        coverUrl: 'edition.jpg',
        language: 'en',
        publisher: null,
        publishYear: 2005,
      },
    });
    expect(c).toMatchObject({
      key: '9780441013593',
      workId: 'ol_OL1W',
      coverUrl: 'edition.jpg',
      isbn: '9780441013593',
      language: 'en',
      isCustom: false,
    });
  });

  it('parses the add mode route param', () => {
    expect(parseAddMode('scan')).toBe('scan');
    expect(parseAddMode('nope')).toBeNull();
    expect(parseAddMode(undefined)).toBeNull();
  });
});

describe('manual entry helpers', () => {
  it('splits authors on commas, trimming and de-duplicating', () => {
    expect(parseAuthors(' Jane Austen ,, jane austen;  Someone   Else ')).toEqual([
      'Jane Austen',
      'Someone Else',
    ]);
    expect(parseAuthors('')).toEqual([]);
  });

  it('picks the language per copy', () => {
    const c = { language: 'hi' } as AddCandidate;
    const base = { shelfId: 's', visibility: 'lendable' as const, format: null };
    expect(languageFor(c, { ...base, language: 'auto' })).toBe('hi');
    expect(languageFor(c, { ...base, language: 'en' })).toBe('en');
    expect(languageFor(c, { ...base, language: null })).toBeNull();
  });

  it('names and normalises languages', () => {
    expect(languageName('en')).toBe('English');
    expect(languageName('kok')).toBe('kok');
    expect(languageName(null)).toBeNull();
    expect(normaliseLanguageInput(' marathi ')).toBe('mr');
    expect(normaliseLanguageInput('EN')).toBe('en');
    expect(normaliseLanguageInput('Konkani')).toBe('Konkani');
    expect(normaliseLanguageInput('   ')).toBeNull();
  });
});
