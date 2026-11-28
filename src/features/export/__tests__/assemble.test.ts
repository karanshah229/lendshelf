import {
  assembleExport,
  buildFullExportJson,
  exportFileName,
  exportSummary,
  mergeLoans,
  workIdsOf,
  type ExportData,
} from '@/features/export/assemble';
import type { Item, Loan, Review, Shelf, Work, WithId } from '@/types/model';

const ts = (iso: string) => {
  const d = new Date(iso);
  return {
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
};

const NOW = new Date(2026, 10, 21, 10, 0);
const T = ts('2026-11-01T10:00:00Z');

const shelf: WithId<Shelf> = {
  id: 'default_me',
  ownerId: 'me',
  name: 'My books',
  isPublic: true,
  sortOrder: 0,
  createdAt: T,
  updatedAt: T,
};

const item = (id: string, title: string, workId: string): WithId<Item> => ({
  id,
  ownerId: 'me',
  workId,
  category: 'book',
  shelfId: shelf.id,
  visibility: 'lendable',
  sharedWithContacts: true,
  title,
  authors: ['Someone'],
  coverUrl: null,
  isCustom: false,
  isbn: null,
  format: 'paperback',
  language: 'en',
  loanState: 'available',
  dueDate: null,
  activeLoanId: null,
  createdAt: T,
  updatedAt: T,
});

const work = (id: string, title: string): WithId<Work> => ({
  id,
  category: 'book',
  source: 'openlibrary',
  title,
  authors: ['Someone'],
  description: null,
  coverUrl: null,
  firstPublishYear: 1990,
  isCustom: false,
  createdBy: null,
  createdAt: T,
  updatedAt: T,
});

const loan = (id: string, ownerId: string, borrowerUid: string | null): WithId<Loan> => ({
  id,
  itemId: 'i1',
  workId: 'ol_1',
  ownerId,
  ownerName: 'Owner',
  ownerPhone: '+919000000001',
  borrowerUid,
  borrowerName: 'Borrower',
  borrowerPhone: null,
  title: 'Dune',
  coverUrl: null,
  status: 'returned',
  message: null,
  dueDate: T,
  requestedAt: T,
  startedAt: T,
  returnMarkedAt: null,
  returnedAt: T,
  updatedAt: T,
});

const review: WithId<Review> = {
  id: 'ol_1_me',
  workId: 'ol_1',
  authorId: 'me',
  authorName: 'Me',
  rating: 5,
  text: 'Great',
  createdAt: T,
  updatedAt: T,
};

const data: ExportData = {
  uid: 'me',
  profile: { name: 'Me', pickupNote: null, createdAt: T, updatedAt: T },
  items: [item('i2', 'Zen', 'ol_2'), item('i1', 'Dune', 'ol_1'), item('i3', 'Dune', 'ol_1')],
  shelves: [shelf],
  works: [work('ol_2', 'Zen'), work('ol_1', 'Dune')],
  loansAsOwner: [loan('a', 'me', 'ravi'), loan('shared', 'me', 'ravi')],
  loansAsBorrower: [loan('b', 'asha', 'me'), loan('shared', 'me', 'ravi')],
  reviews: [review],
  readings: [
    {
      id: 'ol_1_me',
      workId: 'ol_1',
      uid: 'me',
      title: 'Dune',
      authors: [],
      coverUrl: null,
      status: 'finished',
      startedAt: T,
      finishedAt: T,
      createdAt: T,
      updatedAt: T,
    },
  ],
};

describe('helpers', () => {
  it('merges loans without duplicates', () => {
    expect(
      mergeLoans(data.loansAsOwner, data.loansAsBorrower)
        .map((l) => l.id)
        .sort()
    ).toEqual(['a', 'b', 'shared']);
  });

  it('collects distinct work ids', () => {
    expect(workIdsOf(data.items)).toEqual(['ol_1', 'ol_2']);
  });

  it('names files by date', () => {
    expect(exportFileName('csv', NOW)).toBe('lendshelf-books-2026-11-21.csv');
    expect(exportFileName('json', NOW)).toBe('lendshelf-export-2026-11-21.json');
  });

  it('summarises the export', () => {
    expect(exportSummary(data)).toBe('3 books · 1 collection · 3 loans · 1 review');
  });
});

describe('assembleExport', () => {
  it('builds a CSV with one row per copy', () => {
    const file = assembleExport('csv', data, NOW);
    expect(file.mimeType).toBe('text/csv');
    expect(file.fileName).toBe('lendshelf-books-2026-11-21.csv');
    const lines = file.content.replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(lines).toHaveLength(4); // header + 3 copies
    expect(lines[1]).toMatch(/^Dune,/);
    expect(lines[3]).toMatch(/^Zen,/);
  });

  it('builds JSON with works, loans by role and my reviews', () => {
    const file = assembleExport('json', data, NOW);
    expect(file.mimeType).toBe('application/json');
    const parsed = JSON.parse(file.content);
    expect(parsed.app).toBe('LendShelf');
    expect(parsed.exportedAt).toBe(NOW.toISOString());
    expect(parsed.copies).toHaveLength(3);
    expect(parsed.works.map((w: { title: string }) => w.title)).toEqual(['Dune', 'Zen']);
    expect(parsed.loans.lent.map((l: { id: string }) => l.id).sort()).toEqual(['a', 'shared']);
    expect(parsed.loans.borrowed.map((l: { id: string }) => l.id)).toEqual(['b']);
    expect(parsed.reviews).toHaveLength(1);
    expect(parsed.reading).toEqual([
      expect.objectContaining({
        title: 'Dune',
        status: 'finished',
        finishedAt: '2026-11-01T10:00:00.000Z',
      }),
    ]);
    expect(parsed.works[0].createdAt).toBe('2026-11-01T10:00:00.000Z');
  });

  it('buildFullExportJson keeps the base export shape', () => {
    const json = buildFullExportJson(data, NOW);
    expect(Object.keys(json).sort()).toEqual(
      [
        'app',
        'copies',
        'exportedAt',
        'loans',
        'profile',
        'reading',
        'reviews',
        'shelves',
        'version',
        'works',
      ].sort()
    );
  });
});
