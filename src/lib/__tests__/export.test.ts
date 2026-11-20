import { buildCopiesCsv, buildExportJson, csvCell, serialise, toCsv } from '@/lib/export';
import type { Item, Loan, Review, Shelf, WithId } from '@/types/model';

const ts = (iso: string) => {
  const d = new Date(iso);
  return {
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
};

describe('csvCell', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['line\nbreak', '"line\nbreak"'],
    ['cr\rhere', '"cr\rhere"'],
    [' padded', '" padded"'],
    ['=SUM(A1)', "'=SUM(A1)"],
    ['@cmd', "'@cmd"],
    ['-x', "'-x"],
    ['+919876543210', '+919876543210'],
    ['-12.5', '-12.5'],
  ])('%p → %p', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('handles null, numbers and booleans', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(true)).toBe('true');
  });

  it('toCsv uses CRLF', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['c,d', null],
      ])
    ).toBe('a,b\r\n"c,d",\r\n');
  });
});

const shelf: WithId<Shelf> = {
  id: 's1',
  ownerId: 'me',
  name: 'Fiction, mostly',
  isPublic: true,
  sortOrder: 0,
  createdAt: ts('2026-01-01T00:00:00Z'),
  updatedAt: ts('2026-01-01T00:00:00Z'),
};

const item = (over: Partial<WithId<Item>>): WithId<Item> => ({
  id: 'i1',
  ownerId: 'me',
  workId: 'ol_OL1W',
  category: 'book',
  shelfId: 's1',
  visibility: 'lendable',
  sharedWithContacts: true,
  title: 'Dune',
  authors: ['Frank Herbert'],
  coverUrl: null,
  isCustom: false,
  isbn: '9780441013593',
  format: 'paperback',
  language: 'en',
  loanState: 'available',
  dueDate: null,
  activeLoanId: null,
  createdAt: ts('2026-03-05T10:00:00'),
  updatedAt: ts('2026-03-05T10:00:00'),
  ...over,
});

describe('buildCopiesCsv', () => {
  it('writes a header and one escaped row per copy, sorted by title', () => {
    const csv = buildCopiesCsv(
      {
        items: [
          item({
            id: 'i2',
            title: 'The "Best" Book',
            authors: ['A', 'B'],
            loanState: 'lent',
            dueDate: ts('2026-12-12T12:00:00'),
          }),
          item({}),
        ],
        shelves: [shelf],
      },
      { bom: false }
    );
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'Title,Authors,ISBN,Format,Language,Collection,Collection public,Visibility,Status,Due date,Added'
    );
    expect(lines[1]).toBe(
      'Dune,Frank Herbert,9780441013593,paperback,en,"Fiction, mostly",yes,lendable,available,,5 Mar 2026'
    );
    expect(lines[2]).toBe(
      '"The ""Best"" Book",A; B,9780441013593,paperback,en,"Fiction, mostly",yes,lendable,lent,12 Dec 2026,5 Mar 2026'
    );
    expect(lines[3]).toBe('');
  });

  it('prepends a BOM by default', () => {
    expect(buildCopiesCsv({ items: [], shelves: [] }).charCodeAt(0)).toBe(0xfeff);
  });
});

describe('JSON export', () => {
  it('serialise converts timestamps and drops undefined', () => {
    expect(
      serialise({
        a: ts('2026-01-02T03:04:05Z'),
        b: undefined,
        c: [new Date('2026-01-01T00:00:00Z')],
        d: null,
      })
    ).toEqual({
      a: '2026-01-02T03:04:05.000Z',
      c: ['2026-01-01T00:00:00.000Z'],
      d: null,
    });
  });

  it('includes copies, loan history split by role and only my reviews', () => {
    const loan = (id: string, over: Partial<Loan>): WithId<Loan> => ({
      id,
      itemId: 'i1',
      workId: 'w',
      ownerId: 'me',
      ownerName: 'Me',
      ownerPhone: '+919000000001',
      borrowerUid: 'x',
      borrowerName: 'X',
      borrowerPhone: null,
      title: 'Dune',
      coverUrl: null,
      status: 'returned',
      message: null,
      dueDate: null,
      requestedAt: ts('2026-01-01T00:00:00Z'),
      startedAt: null,
      returnMarkedAt: null,
      returnedAt: null,
      updatedAt: ts('2026-01-01T00:00:00Z'),
      ...over,
    });
    const review = (id: string, authorId: string): WithId<Review> => ({
      id,
      workId: 'w',
      authorId,
      authorName: authorId,
      rating: 5,
      text: null,
      createdAt: ts('2026-01-01T00:00:00Z'),
      updatedAt: ts('2026-01-01T00:00:00Z'),
    });

    const out = buildExportJson({
      uid: 'me',
      profile: null,
      shelves: [shelf],
      items: [item({})],
      loans: [
        loan('l1', {}),
        loan('l2', {
          ownerId: 'other',
          borrowerUid: 'me',
          requestedAt: ts('2026-02-01T00:00:00Z'),
        }),
      ],
      reviews: [review('w_me', 'me'), review('w_other', 'other')],
      exportedAt: new Date('2026-11-21T00:00:00Z'),
    });

    expect(out.app).toBe('LendShelf');
    expect(out.version).toBe(1);
    expect(out.exportedAt).toBe('2026-11-21T00:00:00.000Z');
    expect(out.copies).toHaveLength(1);
    expect((out.copies[0] as { createdAt: string }).createdAt).toMatch(/^2026-03-05T/);
    expect(out.loans.lent.map((l) => (l as { id: string }).id)).toEqual(['l1']);
    expect(out.loans.borrowed.map((l) => (l as { id: string }).id)).toEqual(['l2']);
    expect(out.reviews.map((r) => (r as { id: string }).id)).toEqual(['w_me']);
    expect(() => JSON.stringify(out)).not.toThrow();
  });
});
