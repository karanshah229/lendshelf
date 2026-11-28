/** Reading writes (allowed by firestore.rules `readings` and the profile's `shareReading`). */
import { db, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from '@/lib/firebase';
import { COLLECTIONS, readingId, type Reading, type Work } from '@/types/model';

import { stopReadingPlan } from '@/features/reading/reading';

const ref = (workId: string, uid: string) => doc(db, COLLECTIONS.readings, readingId(workId, uid));

/** Marks a book as reading now. A finished book starts again and keeps its last finish date. */
export async function startReading(
  uid: string,
  workId: string,
  work: Pick<Work, 'title' | 'authors' | 'coverUrl'>,
  existing: Reading | null
): Promise<void> {
  if (existing) {
    await updateDoc(ref(workId, uid), {
      status: 'reading',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await setDoc(ref(workId, uid), {
    workId,
    uid,
    title: work.title,
    authors: work.authors.slice(0, 20),
    coverUrl: work.coverUrl,
    status: 'reading',
    startedAt: serverTimestamp(),
    finishedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** "Finished it": moves the book to the Read list with today's date. */
export function finishReading(uid: string, workId: string): Promise<void> {
  return updateDoc(ref(workId, uid), {
    status: 'finished',
    finishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** "Stop reading": back to the Read list if it was read before, otherwise forgotten. */
export function stopReading(uid: string, existing: Reading): Promise<void> {
  if (stopReadingPlan(existing) === 'backToRead') {
    return updateDoc(ref(existing.workId, uid), {
      status: 'finished',
      updatedAt: serverTimestamp(),
    });
  }
  return deleteDoc(ref(existing.workId, uid));
}

/** Removes a book from the Read list (and from reading, if re-reading). */
export function removeReading(uid: string, workId: string): Promise<void> {
  return deleteDoc(ref(workId, uid));
}

/** Shows or hides my reading from my contacts. */
export function setShareReading(uid: string, on: boolean): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.profiles, uid), {
    shareReading: on,
    updatedAt: serverTimestamp(),
  });
}
