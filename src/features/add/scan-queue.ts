/**
 * Review queue for continuous barcode scanning. Each new ISBN is resolved in the background;
 * the queue tracks progress per book and ignores repeat scans of the same ISBN.
 * Newest scans come first.
 */
import type { AddCandidate } from './types';

export type ScanStatus = 'resolving' | 'ready' | 'notFound' | 'error';

export interface ScanEntry {
  isbn: string;
  status: ScanStatus;
  candidate: AddCandidate | null;
  error: string | null;
}

export interface ScanQueueState {
  entries: ScanEntry[];
}

export type ScanQueueAction =
  | { type: 'scanned'; isbn: string }
  | { type: 'resolved'; isbn: string; candidate: AddCandidate }
  | { type: 'notFound'; isbn: string }
  | { type: 'failed'; isbn: string; error: string }
  | { type: 'retry'; isbn: string }
  | { type: 'remove'; isbn: string }
  | { type: 'removeMany'; isbns: readonly string[] }
  | { type: 'clear' };

export const initialScanQueue: ScanQueueState = { entries: [] };

export function hasIsbn(state: ScanQueueState, isbn: string): boolean {
  return state.entries.some((e) => e.isbn === isbn);
}

function patch(
  state: ScanQueueState,
  isbn: string,
  fn: (e: ScanEntry) => ScanEntry
): ScanQueueState {
  let changed = false;
  const entries = state.entries.map((e) => {
    if (e.isbn !== isbn) return e;
    const next = fn(e);
    if (next !== e) changed = true;
    return next;
  });
  return changed ? { entries } : state;
}

export function scanQueueReducer(state: ScanQueueState, action: ScanQueueAction): ScanQueueState {
  switch (action.type) {
    case 'scanned':
      if (hasIsbn(state, action.isbn)) return state;
      return {
        entries: [
          { isbn: action.isbn, status: 'resolving', candidate: null, error: null },
          ...state.entries,
        ],
      };
    case 'resolved':
      return patch(state, action.isbn, (e) => ({
        ...e,
        status: 'ready',
        candidate: action.candidate,
        error: null,
      }));
    case 'notFound':
      return patch(state, action.isbn, (e) => ({
        ...e,
        status: 'notFound',
        candidate: null,
        error: null,
      }));
    case 'failed':
      return patch(state, action.isbn, (e) => ({
        ...e,
        status: 'error',
        candidate: null,
        error: action.error,
      }));
    case 'retry':
      return patch(state, action.isbn, (e) =>
        e.status === 'error' ? { ...e, status: 'resolving', error: null } : e
      );
    case 'remove': {
      const entries = state.entries.filter((e) => e.isbn !== action.isbn);
      return entries.length === state.entries.length ? state : { entries };
    }
    case 'removeMany': {
      const drop = new Set(action.isbns);
      const entries = state.entries.filter((e) => !drop.has(e.isbn));
      return entries.length === state.entries.length ? state : { entries };
    }
    case 'clear':
      return state.entries.length ? initialScanQueue : state;
  }
}

export interface ScanQueueSummary {
  total: number;
  resolving: number;
  ready: number;
  notFound: number;
  error: number;
  /** Candidates ready to add, oldest scan first (shelf order). */
  readyCandidates: AddCandidate[];
}

export function summariseScanQueue(state: ScanQueueState): ScanQueueSummary {
  const s: ScanQueueSummary = {
    total: state.entries.length,
    resolving: 0,
    ready: 0,
    notFound: 0,
    error: 0,
    readyCandidates: [],
  };
  for (const e of state.entries) {
    s[e.status] += 1;
    if (e.status === 'ready' && e.candidate) s.readyCandidates.unshift(e.candidate);
  }
  return s;
}
