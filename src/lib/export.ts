/**
 * Export builders (SPEC §1 Export): CSV with one row per copy, and JSON with copies,
 * loan history and your reviews. Generated on device; the screen shares the result.
 */
import { formatLongDate } from '@/lib/dates';
import type { Item, Loan, Profile, Review, Shelf, TimestampLike, WithId } from '@/types/model';

// ---------- CSV ----------

const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;
const FORMULA_START = /^[=+\-@\t\r]/;
const NUMERIC_LIKE = /^[+-]?[\d\s().,-]+$/;

/**
 * Escapes one CSV cell (RFC 4180): quotes cells containing commas, quotes, newlines or
 * leading/trailing spaces, doubling inner quotes. Cells that a spreadsheet would run as a
 * formula (starting with = + - @) are prefixed with an apostrophe, except plain numbers.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (FORMULA_START.test(s) && !NUMERIC_LIKE.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Joins rows into CSV text with CRLF line endings. */
export function toCsv(
  rows: readonly (readonly (string | number | boolean | null | undefined)[])[]
): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export const COPIES_CSV_HEADER = [
  'Title',
  'Authors',
  'ISBN',
  'Format',
  'Language',
  'Collection',
  'Collection public',
  'Visibility',
  'Status',
  'Due date',
  'Added',
] as const;

const tsDate = (ts: TimestampLike | null | undefined) => (ts ? formatLongDate(ts.toDate()) : '');

export interface CopiesCsvInput {
  items: readonly WithId<Item>[];
  shelves: readonly WithId<Shelf>[];
}

/** CSV with one row per copy. A UTF-8 BOM is prepended so Excel reads accents correctly. */
export function buildCopiesCsv({ items, shelves }: CopiesCsvInput, { bom = true } = {}): string {
  const shelfById = new Map(shelves.map((s) => [s.id, s]));
  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
  const rows = sorted.map((item) => {
    const shelf = shelfById.get(item.shelfId);
    return [
      item.title,
      item.authors.join('; '),
      item.isbn,
      item.format,
      item.language,
      shelf?.name ?? '',
      shelf ? (shelf.isPublic ? 'yes' : 'no') : '',
      item.visibility,
      item.loanState,
      tsDate(item.dueDate),
      tsDate(item.createdAt),
    ];
  });
  return (bom ? '﻿' : '') + toCsv([[...COPIES_CSV_HEADER], ...rows]);
}

// ---------- JSON ----------

export const EXPORT_VERSION = 1;

function isTimestampLike(v: unknown): v is TimestampLike {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as TimestampLike).toDate === 'function' &&
    typeof (v as TimestampLike).seconds === 'number'
  );
}

/** Deep-copies a value, turning Firestore timestamps and Dates into ISO strings. */
export function serialise(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (isTimestampLike(value)) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = serialise(v);
    }
    return out;
  }
  return value;
}

export interface ExportJsonInput {
  uid: string;
  profile: Profile | null;
  shelves: readonly WithId<Shelf>[];
  items: readonly WithId<Item>[];
  /** Loans where you are owner or borrower (full history). */
  loans: readonly WithId<Loan>[];
  reviews: readonly WithId<Review>[];
  exportedAt?: Date;
}

export interface ExportJson {
  app: 'LendShelf';
  version: number;
  exportedAt: string;
  profile: unknown;
  shelves: unknown[];
  copies: unknown[];
  loans: { lent: unknown[]; borrowed: unknown[] };
  reviews: unknown[];
}

/** The JSON export object (copies + loan history + your reviews). */
export function buildExportJson(input: ExportJsonInput): ExportJson {
  const { uid } = input;
  const byStarted = (a: WithId<Loan>, b: WithId<Loan>) =>
    (b.requestedAt?.toMillis() ?? b.updatedAt.toMillis()) -
    (a.requestedAt?.toMillis() ?? a.updatedAt.toMillis());
  const loans = [...input.loans].sort(byStarted);
  return {
    app: 'LendShelf',
    version: EXPORT_VERSION,
    exportedAt: (input.exportedAt ?? new Date()).toISOString(),
    profile: serialise(input.profile),
    shelves: input.shelves.map(serialise),
    copies: input.items.map(serialise),
    loans: {
      lent: loans.filter((l) => l.ownerId === uid).map(serialise),
      borrowed: loans.filter((l) => l.borrowerUid === uid).map(serialise),
    },
    reviews: input.reviews.filter((r) => r.authorId === uid).map(serialise),
  };
}

/** Pretty-printed JSON text of the export. */
export function buildExportJsonText(input: ExportJsonInput): string {
  return JSON.stringify(buildExportJson(input), null, 2);
}
