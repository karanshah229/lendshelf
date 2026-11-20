import {
  hasIsbn,
  initialScanQueue,
  scanQueueReducer,
  summariseScanQueue,
  type ScanQueueAction,
  type ScanQueueState,
} from '@/features/add/scan-queue';
import type { AddCandidate } from '@/features/add/types';

const candidate = (isbn: string, title = `Book ${isbn}`): AddCandidate => ({
  key: isbn,
  workId: `ol_${isbn}`,
  title,
  authors: ['Someone'],
  coverUrl: null,
  isCustom: false,
  isbn,
  language: 'en',
});

const run = (...actions: ScanQueueAction[]): ScanQueueState =>
  actions.reduce(scanQueueReducer, initialScanQueue);

describe('scanQueueReducer', () => {
  it('adds new scans to the top as resolving', () => {
    const s = run({ type: 'scanned', isbn: 'A' }, { type: 'scanned', isbn: 'B' });
    expect(s.entries.map((e) => [e.isbn, e.status])).toEqual([
      ['B', 'resolving'],
      ['A', 'resolving'],
    ]);
  });

  it('ignores repeat scans of the same ISBN (same state object)', () => {
    const s1 = run({ type: 'scanned', isbn: 'A' });
    const s2 = scanQueueReducer(s1, { type: 'scanned', isbn: 'A' });
    expect(s2).toBe(s1);
    expect(hasIsbn(s2, 'A')).toBe(true);
    expect(hasIsbn(s2, 'B')).toBe(false);
  });

  it('records resolved, not-found and failed lookups', () => {
    const s = run(
      { type: 'scanned', isbn: 'A' },
      { type: 'scanned', isbn: 'B' },
      { type: 'scanned', isbn: 'C' },
      { type: 'resolved', isbn: 'A', candidate: candidate('A') },
      { type: 'notFound', isbn: 'B' },
      { type: 'failed', isbn: 'C', error: 'Offline' }
    );
    const byIsbn = Object.fromEntries(s.entries.map((e) => [e.isbn, e]));
    expect(byIsbn.A?.status).toBe('ready');
    expect(byIsbn.A?.candidate?.title).toBe('Book A');
    expect(byIsbn.B?.status).toBe('notFound');
    expect(byIsbn.C).toMatchObject({ status: 'error', error: 'Offline' });
  });

  it('retries only failed entries', () => {
    let s = run(
      { type: 'scanned', isbn: 'A' },
      { type: 'failed', isbn: 'A', error: 'x' },
      { type: 'retry', isbn: 'A' }
    );
    expect(s.entries[0]).toMatchObject({ status: 'resolving', error: null });
    s = scanQueueReducer(s, { type: 'resolved', isbn: 'A', candidate: candidate('A') });
    expect(scanQueueReducer(s, { type: 'retry', isbn: 'A' })).toBe(s);
  });

  it('ignores results for ISBNs that were removed meanwhile', () => {
    const s = run({ type: 'scanned', isbn: 'A' }, { type: 'remove', isbn: 'A' });
    expect(scanQueueReducer(s, { type: 'resolved', isbn: 'A', candidate: candidate('A') })).toBe(s);
    expect(s.entries).toHaveLength(0);
  });

  it('removes many and clears', () => {
    const s = run(
      { type: 'scanned', isbn: 'A' },
      { type: 'scanned', isbn: 'B' },
      { type: 'scanned', isbn: 'C' },
      { type: 'removeMany', isbns: ['A', 'C'] }
    );
    expect(s.entries.map((e) => e.isbn)).toEqual(['B']);
    expect(scanQueueReducer(s, { type: 'clear' })).toEqual(initialScanQueue);
    expect(scanQueueReducer(initialScanQueue, { type: 'clear' })).toBe(initialScanQueue);
  });
});

describe('summariseScanQueue', () => {
  it('counts statuses and lists ready books oldest scan first', () => {
    const s = run(
      { type: 'scanned', isbn: 'A' },
      { type: 'scanned', isbn: 'B' },
      { type: 'scanned', isbn: 'C' },
      { type: 'scanned', isbn: 'D' },
      { type: 'resolved', isbn: 'A', candidate: candidate('A') },
      { type: 'resolved', isbn: 'C', candidate: candidate('C') },
      { type: 'notFound', isbn: 'D' }
    );
    const sum = summariseScanQueue(s);
    expect(sum).toMatchObject({ total: 4, resolving: 1, ready: 2, notFound: 1, error: 0 });
    expect(sum.readyCandidates.map((c) => c.isbn)).toEqual(['A', 'C']);
  });
});
