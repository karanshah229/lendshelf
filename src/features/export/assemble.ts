/**
 * Pure export assembly: turns the data read for the signed-in user into the file to share.
 * CSV = one row per copy; JSON = profile, collections, copies, their Books, loan history
 * (as owner and as borrower) and my reviews. Builders live in `@/lib/export`.
 */
import { toISODate } from '@/lib/dates';
import { buildCopiesCsv, buildExportJson, serialise, type ExportJson } from '@/lib/export';
import type { Item, Loan, Profile, Review, Shelf, Work, WithId } from '@/types/model';

export type ExportFormat = 'csv' | 'json';

export interface ExportData {
  uid: string;
  profile: Profile | null;
  items: readonly WithId<Item>[];
  shelves: readonly WithId<Shelf>[];
  works: readonly WithId<Work>[];
  loansAsOwner: readonly WithId<Loan>[];
  loansAsBorrower: readonly WithId<Loan>[];
  reviews: readonly WithId<Review>[];
}

export interface ExportFile {
  fileName: string;
  mimeType: string;
  /** iOS Uniform Type Identifier for the share sheet. */
  uti: string;
  content: string;
}

export type FullExportJson = ExportJson & { works: unknown[] };

/** Loans as owner + as borrower, without duplicates. */
export function mergeLoans(a: readonly WithId<Loan>[], b: readonly WithId<Loan>[]): WithId<Loan>[] {
  const byId = new Map<string, WithId<Loan>>();
  for (const l of [...a, ...b]) byId.set(l.id, l);
  return [...byId.values()];
}

/** Distinct Book ids of my copies. */
export function workIdsOf(items: readonly Pick<Item, 'workId'>[]): string[] {
  return [...new Set(items.map((i) => i.workId).filter(Boolean))].sort();
}

/** The JSON export with the Books of my copies added (sorted by title). */
export function buildFullExportJson(data: ExportData, exportedAt: Date): FullExportJson {
  const base = buildExportJson({
    uid: data.uid,
    profile: data.profile,
    shelves: data.shelves,
    items: data.items,
    loans: mergeLoans(data.loansAsOwner, data.loansAsBorrower),
    reviews: data.reviews,
    exportedAt,
  });
  const works = [...data.works].sort((a, b) => a.title.localeCompare(b.title)).map(serialise);
  return { ...base, works };
}

export function exportFileName(format: ExportFormat, now: Date): string {
  const day = toISODate(now);
  return format === 'csv' ? `lendshelf-books-${day}.csv` : `lendshelf-export-${day}.json`;
}

/** Builds the file for the chosen format. */
export function assembleExport(
  format: ExportFormat,
  data: ExportData,
  now: Date = new Date()
): ExportFile {
  if (format === 'csv') {
    return {
      fileName: exportFileName('csv', now),
      mimeType: 'text/csv',
      uti: 'public.comma-separated-values-text',
      content: buildCopiesCsv({ items: data.items, shelves: data.shelves }),
    };
  }
  return {
    fileName: exportFileName('json', now),
    mimeType: 'application/json',
    uti: 'public.json',
    content: JSON.stringify(buildFullExportJson(data, now), null, 2),
  };
}

/** One-line summary for the export sheet, e.g. "212 books · 3 collections · 18 loans · 9 reviews". */
export function exportSummary(
  data: Pick<ExportData, 'items' | 'shelves' | 'loansAsOwner' | 'loansAsBorrower' | 'reviews'>
): string {
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const loans = mergeLoans(data.loansAsOwner, data.loansAsBorrower).length;
  return [
    n(data.items.length, 'book'),
    n(data.shelves.length, 'collection'),
    n(loans, 'loan'),
    n(data.reviews.length, 'review'),
  ].join(' · ');
}
