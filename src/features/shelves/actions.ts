/**
 * Collection writes. Create, rename and reorder are direct Firestore writes (the rules allow
 * the owner to change name and sortOrder); public/private and delete go through callables
 * because they recompute every copy's `sharedWithContacts`.
 */
import { api } from '@/lib/api';
import {
  collection,
  db,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from '@/lib/firebase';
import { COLLECTIONS } from '@/types/model';

import type { SortOrderUpdate } from './logic';

export async function createShelf(input: {
  uid: string;
  name: string;
  isPublic: boolean;
  sortOrder: number;
}): Promise<string> {
  const ref = doc(collection(db, COLLECTIONS.shelves));
  const now = serverTimestamp();
  await setDoc(ref, {
    ownerId: input.uid,
    name: input.name,
    isPublic: input.isPublic,
    sortOrder: input.sortOrder,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export function renameShelf(shelfId: string, name: string): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.shelves, shelfId), { name, updatedAt: serverTimestamp() });
}

export async function saveSortOrders(updates: SortOrderUpdate[]): Promise<void> {
  if (!updates.length) return;
  const batch = writeBatch(db);
  const now = serverTimestamp();
  for (const u of updates) {
    batch.update(doc(db, COLLECTIONS.shelves, u.id), { sortOrder: u.sortOrder, updatedAt: now });
  }
  await batch.commit();
}

export function setShelfPublic(shelfId: string, isPublic: boolean) {
  return api.setShelfVisibility({ shelfId, isPublic });
}

export function deleteShelf(shelfId: string, moveToShelfId: string) {
  return api.deleteShelf({ shelfId, moveToShelfId });
}
