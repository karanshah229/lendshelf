import type { ResolveBookResponse } from '@/lib/api';

/**
 * A book about to be added as a copy. Either a Book that already exists (`workId` set: from the
 * catalogue via resolveBook, or one of my own hand-entered books) or a new hand-entered Book
 * that is created on save (`newWork`).
 */
export interface AddCandidate {
  /** Stable key for lists (ISBN, workId or a random key). */
  key: string;
  workId: string | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isCustom: boolean;
  isbn: string | null;
  /** Language detected from the edition (e.g. "en"), if known. */
  language: string | null;
  /** Set for a hand-entered book that doesn't exist yet. */
  newWork?: {
    /** Local image URI to upload as the cover, if the user picked one. */
    localCoverUri: string | null;
    coverMimeType: string | null;
  };
}

/** Candidate from a `resolveBook` response. Prefers the edition's cover and ISBN. */
export function candidateFromResolved(res: ResolveBookResponse, key?: string): AddCandidate {
  return {
    key: key ?? res.edition.isbn ?? res.workId,
    workId: res.workId,
    title: res.work.title,
    authors: res.work.authors,
    coverUrl: res.edition.coverUrl ?? res.work.coverUrl,
    isCustom: res.work.isCustom,
    isbn: res.edition.isbn,
    language: res.edition.language,
  };
}

export type AddMode = 'search' | 'scan' | 'manual';

export function parseAddMode(value: unknown): AddMode | null {
  return value === 'search' || value === 'scan' || value === 'manual' ? value : null;
}
