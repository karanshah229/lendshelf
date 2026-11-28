/**
 * Currently reading and the Read list, pure. One `readings/{workId}_{uid}` record per book:
 * 'reading' now, or 'finished'. Re-reading a finished book moves it back to 'reading' and keeps
 * the last finish date, so "Stop reading" can put it back in the Read list.
 */
import { formatShortDate } from '@/lib/dates';
import { MAX_READING, type Profile, type Reading, type WithId } from '@/types/model';

type R = WithId<Reading>;

/**
 * A date the server hasn't confirmed yet (null right after a write on this device) counts as
 * now: it was just set.
 */
const millis = (t: Reading['startedAt'] | undefined, now = Date.now()) => t?.toMillis() ?? now;
const dateOf = (t: Reading['startedAt'] | undefined, now: Date) => t ?? now;

/** In the Read list: finished, or finished before and being read again. */
const wasFinished = (r: Pick<Reading, 'status' | 'finishedAt'>) =>
  r.status === 'finished' || !!r.finishedAt;

/** Books being read now (latest started first) and books finished (latest finished first). */
export function splitReadings(readings: readonly R[]): { now: R[]; read: R[] } {
  return {
    now: readings
      .filter((r) => r.status === 'reading')
      .sort((a, b) => millis(b.startedAt) - millis(a.startedAt)),
    // A book being re-read stays in the history: it was finished before.
    read: readings.filter(wasFinished).sort((a, b) => millis(b.finishedAt) - millis(a.finishedAt)),
  };
}

export type StartCheck = { ok: true; again: boolean } | { ok: false; reason: 'tooMany' };

/**
 * Whether I can mark this book as reading: up to MAX_READING at once. `again` when it's in my
 * Read list already ("Reading it again").
 */
export function canStartReading(existing: Reading | null, readingNow: number): StartCheck {
  if (readingNow >= MAX_READING) return { ok: false, reason: 'tooMany' };
  return { ok: true, again: !!existing && wasFinished(existing) };
}

export const TOO_MANY_READING = `You’re reading ${MAX_READING} books. Finish or stop one first.`;

/** "Stop reading": a book read before goes back to the Read list; otherwise the record goes. */
export function stopReadingPlan(existing: Pick<Reading, 'finishedAt'>): 'backToRead' | 'remove' {
  return existing.finishedAt ? 'backToRead' : 'remove';
}

/** "Reading since 3 Nov". */
export const readingSinceLabel = (r: Pick<Reading, 'startedAt'>, now: Date = new Date()) =>
  `Reading since ${formatShortDate(dateOf(r.startedAt, now), now)}`;

/** "Finished 3 Nov" (with the year when it isn't this year). */
export const finishedLabel = (r: Pick<Reading, 'status' | 'finishedAt'>, now: Date = new Date()) =>
  wasFinished(r) ? `Finished ${formatShortDate(dateOf(r.finishedAt, now), now)}` : '';

/** Second half of "Reading since 25 Nov · read before, finished 3 May" on a re-read, or ''. */
export const readBeforeLabel = (r: Pick<Reading, 'finishedAt'>, now: Date = new Date()) =>
  r.finishedAt ? `read before, finished ${formatShortDate(r.finishedAt, now)}` : '';

/** Me tab row detail: "2 now · 14 read", "1 now", "3 read" or "Nothing yet". */
export function readingSummary(nowCount: number, readCount: number): string {
  const parts: string[] = [];
  if (nowCount) parts.push(`${nowCount} now`);
  if (readCount) parts.push(`${readCount} read`);
  return parts.length ? parts.join(' · ') : 'Nothing yet';
}

/** Whether my reading is shown to my contacts (older profiles have no flag: shared). */
export const sharesReading = (profile: Pick<Profile, 'shareReading'> | null | undefined) =>
  profile?.shareReading !== false;

export interface CircleRead {
  workId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  /** Who is reading it, latest started first. */
  readers: string[];
  latest: number;
}

/**
 * What my contacts are reading now, one entry per book with everyone reading it, latest
 * started first. My own reading is left out.
 */
export function circleReading(readings: readonly R[], myUid: string, limit = 10): CircleRead[] {
  const byWork = new Map<string, CircleRead>();
  const sorted = readings
    .filter((r) => r.status === 'reading' && r.uid !== myUid)
    .sort((a, b) => millis(b.startedAt) - millis(a.startedAt));
  for (const r of sorted) {
    const entry = byWork.get(r.workId);
    if (entry) {
      if (!entry.readers.includes(r.uid)) entry.readers.push(r.uid);
      entry.coverUrl ??= r.coverUrl;
    } else {
      byWork.set(r.workId, {
        workId: r.workId,
        title: r.title,
        authors: r.authors,
        coverUrl: r.coverUrl,
        readers: [r.uid],
        latest: millis(r.startedAt),
      });
    }
  }
  return [...byWork.values()].slice(0, limit);
}

/** Contacts reading this book now (uids, latest started first). */
export function readersOf(readings: readonly R[], workId: string, myUid: string): string[] {
  return (
    circleReading(readings, myUid, Number.MAX_SAFE_INTEGER).find((c) => c.workId === workId)
      ?.readers ?? []
  );
}
