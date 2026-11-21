/**
 * Client-side Firestore writes used by the Discover/Book/Copy/Wishlist/Review screens.
 * Every write here is allowed by firestore.rules (see functions/README.md "Write rules").
 */
import { db, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from '@/lib/firebase';
import {
  COLLECTIONS,
  isSharedWithContacts,
  reviewId,
  watchId,
  type ItemFormat,
  type Rating,
  type Visibility,
} from '@/types/model';

import { askForPushInContext } from '@/features/push-ask/ask';
import { reviewFields } from '@/features/reviews/review-logic';

// ---------- Watches ----------

/** Adds or removes a Book from my wishlist (`watches/{uid}_wishlist_{workId}`). */
export async function setWishlisted(
  uid: string,
  work: { workId: string; title: string },
  on: boolean
): Promise<void> {
  const ref = doc(db, COLLECTIONS.watches, watchId(uid, 'wishlist', work.workId));
  if (!on) return deleteDoc(ref);
  await setDoc(ref, {
    uid,
    type: 'wishlist',
    targetId: work.workId,
    workId: work.workId,
    title: work.title.slice(0, 300),
    createdAt: serverTimestamp(),
  });
  // C11: a wishlist book is a future event ("Get told when a friend has it?").
  void askForPushInContext('wishlist', { title: work.title });
}

/** "Notify me when this copy is back" (`watches/{uid}_back_{itemId}`). */
export async function setWatchingBack(
  uid: string,
  item: { id: string; workId: string; title: string },
  on: boolean
): Promise<void> {
  const ref = doc(db, COLLECTIONS.watches, watchId(uid, 'back', item.id));
  if (!on) return deleteDoc(ref);
  await setDoc(ref, {
    uid,
    type: 'back',
    targetId: item.id,
    workId: item.workId,
    title: item.title.slice(0, 300),
    createdAt: serverTimestamp(),
  });
}

/** Removes any watch by id. */
export function removeWatch(id: string): Promise<void> {
  return deleteDoc(doc(db, COLLECTIONS.watches, id));
}

// ---------- Items (owner) ----------
// Loan fields (loanState, dueDate, activeLoanId) are never touched: the rules require them unchanged.

/** Changes a copy's visibility, keeping `sharedWithContacts` consistent with its shelf. */
export function updateItemVisibility(
  itemId: string,
  visibility: Visibility,
  shelfIsPublic: boolean
): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.items, itemId), {
    visibility,
    sharedWithContacts: isSharedWithContacts(shelfIsPublic, visibility),
    updatedAt: serverTimestamp(),
  });
}

/** Moves a copy to another of my collections, recomputing `sharedWithContacts`. */
export function moveItemToShelf(
  itemId: string,
  shelf: { id: string; isPublic: boolean },
  visibility: Visibility
): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.items, itemId), {
    shelfId: shelf.id,
    sharedWithContacts: isSharedWithContacts(shelf.isPublic, visibility),
    updatedAt: serverTimestamp(),
  });
}

/** Edits a copy's edition details. */
export function updateItemEdition(
  itemId: string,
  edition: { format: ItemFormat | null; language: string | null }
): Promise<void> {
  return updateDoc(doc(db, COLLECTIONS.items, itemId), {
    format: edition.format,
    language: edition.language ? edition.language.slice(0, 20) : null,
    updatedAt: serverTimestamp(),
  });
}

/** Deletes a copy (rules refuse while it's lent). */
export function deleteItem(itemId: string): Promise<void> {
  return deleteDoc(doc(db, COLLECTIONS.items, itemId));
}

// ---------- Reviews ----------

/** Creates or updates my review of a Book (`reviews/{workId}_{uid}`). */
export async function saveReview(input: {
  workId: string;
  uid: string;
  authorName: string;
  rating: Rating;
  text: string;
  /** True when I already have a review (keeps its createdAt). */
  exists: boolean;
}): Promise<void> {
  const ref = doc(db, COLLECTIONS.reviews, reviewId(input.workId, input.uid));
  const fields = reviewFields(input);
  if (input.exists) {
    await updateDoc(ref, {
      authorName: fields.authorName,
      rating: fields.rating,
      text: fields.text,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}

export function deleteReview(workId: string, uid: string): Promise<void> {
  return deleteDoc(doc(db, COLLECTIONS.reviews, reviewId(workId, uid)));
}
