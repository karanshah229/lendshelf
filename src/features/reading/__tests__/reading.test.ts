import {
  canStartReading,
  circleReading,
  finishedLabel,
  readBeforeLabel,
  readersOf,
  readingSinceLabel,
  readingSummary,
  sharesReading,
  splitReadings,
  stopReadingPlan,
} from '@/features/reading/reading';
import { MAX_READING, type Reading, type TimestampLike, type WithId } from '@/types/model';

const ts = (iso: string): TimestampLike => {
  const d = new Date(iso);
  return {
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
};

function reading(
  workId: string,
  uid: string,
  o: Partial<Reading> & { started?: string; finished?: string } = {}
): WithId<Reading> {
  const { started = '2026-11-01T10:00:00', finished, ...rest } = o;
  return {
    id: `${workId}_${uid}`,
    workId,
    uid,
    title: workId,
    authors: [],
    coverUrl: null,
    status: finished && !rest.status ? 'finished' : 'reading',
    startedAt: ts(started),
    finishedAt: finished ? ts(finished) : null,
    createdAt: ts(started),
    updatedAt: ts(started),
    ...rest,
  };
}

const NOW = new Date('2026-11-28T12:00:00');

describe('splitReadings', () => {
  it('lists reading now by latest start and the Read list by latest finish', () => {
    const list = [
      reading('a', 'me', { started: '2026-11-02' }),
      reading('b', 'me', { started: '2026-11-20' }),
      reading('c', 'me', { finished: '2026-10-01' }),
      reading('d', 'me', { finished: '2026-11-10' }),
    ];
    const { now, read } = splitReadings(list);
    expect(now.map((r) => r.workId)).toEqual(['b', 'a']);
    expect(read.map((r) => r.workId)).toEqual(['d', 'c']);
  });

  it('keeps a book being re-read in the Read list too', () => {
    const again = reading('a', 'me', { status: 'reading', finished: '2026-05-01' });
    const { now, read } = splitReadings([again]);
    expect(now).toHaveLength(1);
    expect(read).toHaveLength(1);
  });
});

describe('starting and stopping', () => {
  it('allows up to the cap and says when it is a re-read', () => {
    expect(canStartReading(null, 0)).toEqual({ ok: true, again: false });
    expect(canStartReading(reading('a', 'me', { finished: '2026-01-01' }), 2)).toEqual({
      ok: true,
      again: true,
    });
    expect(canStartReading(null, MAX_READING)).toEqual({ ok: false, reason: 'tooMany' });
  });

  it('puts a book read before back in the Read list, otherwise removes it', () => {
    expect(stopReadingPlan({ finishedAt: ts('2026-01-01') })).toBe('backToRead');
    expect(stopReadingPlan({ finishedAt: null })).toBe('remove');
  });
});

describe('dates the server has not confirmed yet', () => {
  it('count as now, so a just-marked book sorts first and labels today', () => {
    const fresh = reading('new', 'me', { startedAt: null });
    const old = reading('old', 'me', { started: '2026-11-02' });
    expect(splitReadings([old, fresh]).now.map((r) => r.workId)).toEqual(['new', 'old']);
    expect(readingSinceLabel(fresh, NOW)).toBe('Reading since 28 Nov');
  });

  it('keep a just-finished book in the Read list with today’s date', () => {
    const justDone = reading('a', 'me', { status: 'finished', finishedAt: null });
    expect(splitReadings([justDone]).read).toHaveLength(1);
    expect(finishedLabel(justDone, NOW)).toBe('Finished 28 Nov');
    expect(canStartReading(justDone, 0)).toEqual({ ok: true, again: true });
  });
});

describe('labels', () => {
  it('words dates and the Me row summary', () => {
    expect(readingSinceLabel(reading('a', 'me', { started: '2026-11-03T09:00:00' }), NOW)).toBe(
      'Reading since 3 Nov'
    );
    expect(finishedLabel(reading('a', 'me', { finished: '2025-12-24T09:00:00' }), NOW)).toBe(
      'Finished 24 Dec 2025'
    );
    expect(finishedLabel(reading('a', 'me'), NOW)).toBe('');
    expect(readBeforeLabel(reading('a', 'me', { finished: '2026-05-03T09:00:00' }), NOW)).toBe(
      'read before, finished 3 May'
    );
    expect(readBeforeLabel(reading('a', 'me'), NOW)).toBe('');
    expect(readingSummary(2, 14)).toBe('2 now · 14 read');
    expect(readingSummary(1, 0)).toBe('1 now');
    expect(readingSummary(0, 3)).toBe('3 read');
    expect(readingSummary(0, 0)).toBe('Nothing yet');
  });

  it('treats a profile without the flag as sharing', () => {
    expect(sharesReading({})).toBe(true);
    expect(sharesReading(null)).toBe(true);
    expect(sharesReading({ shareReading: true })).toBe(true);
    expect(sharesReading({ shareReading: false })).toBe(false);
  });
});

describe('circleReading', () => {
  const list = [
    reading('hobbit', 'asha', { started: '2026-11-10' }),
    reading('hobbit', 'ravi', { started: '2026-11-20' }),
    reading('dune', 'meera', { started: '2026-11-15' }),
    reading('dune', 'me', { started: '2026-11-25' }),
    reading('emma', 'kabir', { finished: '2026-11-26' }),
  ];

  it('groups contacts reading the same book, latest first, leaving out me and finished books', () => {
    const out = circleReading(list, 'me');
    expect(out.map((c) => c.workId)).toEqual(['hobbit', 'dune']);
    expect(out[0]!.readers).toEqual(['ravi', 'asha']);
    expect(out[1]!.readers).toEqual(['meera']);
  });

  it('lists who is reading one book', () => {
    expect(readersOf(list, 'hobbit', 'me')).toEqual(['ravi', 'asha']);
    expect(readersOf(list, 'dune', 'me')).toEqual(['meera']);
    expect(readersOf(list, 'emma', 'me')).toEqual([]);
  });

  it('caps the number of books', () => {
    expect(circleReading(list, 'me', 1)).toHaveLength(1);
  });
});
