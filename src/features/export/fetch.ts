/** Reads everything the export needs for the signed-in user (one-shot, rule-provable queries). */
import type { ExportData } from '@/features/export/assemble';
import { workIdsOf } from '@/features/export/assemble';
import { collection, db, doc, getDoc, getDocs, query, where } from '@/lib/firebase';
import {
  COLLECTIONS,
  fromQuerySnap,
  fromSnap,
  type Item,
  type Loan,
  type Profile,
  type Reading,
  type Review,
  type Shelf,
  type Work,
  type WithId,
} from '@/types/model';

async function list<T>(name: string, field: string, uid: string): Promise<WithId<T>[]> {
  const snap = await getDocs(query(collection(db, name), where(field, '==', uid)));
  return fromQuerySnap<T>(snap);
}

export async function fetchExportData(uid: string, profile: Profile | null): Promise<ExportData> {
  const [items, shelves, loansAsOwner, loansAsBorrower, reviews, readings] = await Promise.all([
    list<Item>(COLLECTIONS.items, 'ownerId', uid),
    list<Shelf>(COLLECTIONS.shelves, 'ownerId', uid),
    list<Loan>(COLLECTIONS.loans, 'ownerId', uid),
    list<Loan>(COLLECTIONS.loans, 'borrowerUid', uid),
    list<Review>(COLLECTIONS.reviews, 'authorId', uid),
    list<Reading>(COLLECTIONS.readings, 'uid', uid),
  ]);

  // Books of my copies; a missing or unreadable Book is simply left out.
  const workResults = await Promise.allSettled(
    workIdsOf(items).map((id) => getDoc(doc(db, COLLECTIONS.works, id)))
  );
  const works: WithId<Work>[] = [];
  for (const r of workResults) {
    if (r.status !== 'fulfilled') continue;
    const work = fromSnap<Work>(r.value);
    if (work) works.push(work);
  }

  return {
    uid,
    profile,
    items,
    shelves,
    works,
    loansAsOwner,
    loansAsBorrower,
    reviews,
    readings,
  };
}
