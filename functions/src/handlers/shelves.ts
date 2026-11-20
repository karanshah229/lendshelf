import type { DocumentSnapshot, Firestore, Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { ts, type Caller, type Deps } from "../lib/context.js";
import { denied, HttpsError, notFound, parseInput } from "../lib/errors.js";
import { computeSharedWithContacts } from "../lib/sharing.js";
import { COL, type ItemDoc, type ShelfDoc } from "../model.js";

/** Firestore batches/transactions allow 500 writes; keep headroom. */
const MAX_ITEMS_PER_SHELF_OP = 480;

const id = z.string().trim().min(1).max(200);

export const setShelfVisibilitySchema = z.object({ shelfId: id, isPublic: z.boolean() });
export const deleteShelfSchema = z.object({ shelfId: id, moveToShelfId: id });

async function ownShelf(tx: Transaction, db: Firestore, shelfId: string, uid: string): Promise<DocumentSnapshot> {
  const snap = await tx.get(db.collection(COL.shelves).doc(shelfId));
  if (!snap.exists) throw notFound("Collection");
  if ((snap.data() as ShelfDoc).ownerId !== uid) throw denied("That collection isn't yours.");
  return snap;
}

/** Toggle a shelf public/private and recompute `sharedWithContacts` on its items atomically. */
export async function setShelfVisibility(deps: Deps, caller: Caller, data: unknown): Promise<{ updated: number }> {
  const { shelfId, isPublic } = parseInput(setShelfVisibilitySchema, data);
  const { db } = deps;
  return db.runTransaction(async (tx) => {
    const shelf = await ownShelf(tx, db, shelfId, caller.uid);
    const items = await tx.get(
      db.collection(COL.items).where("ownerId", "==", caller.uid).where("shelfId", "==", shelfId),
    );
    if (items.size > MAX_ITEMS_PER_SHELF_OP) {
      throw new HttpsError("resource-exhausted", `This collection has more than ${MAX_ITEMS_PER_SHELF_OP} books; split it first.`);
    }
    const now = ts(deps.now());
    tx.update(shelf.ref, { isPublic, updatedAt: now });
    let updated = 0;
    for (const d of items.docs) {
      const item = d.data() as ItemDoc;
      const shared = computeSharedWithContacts(isPublic, item.visibility);
      if (shared !== item.sharedWithContacts) {
        tx.update(d.ref, { sharedWithContacts: shared, updatedAt: now });
        updated++;
      }
    }
    return { updated };
  });
}

/** Move a shelf's items to another of the caller's shelves, then delete it. */
export async function deleteShelf(deps: Deps, caller: Caller, data: unknown): Promise<{ moved: number }> {
  const { shelfId, moveToShelfId } = parseInput(deleteShelfSchema, data);
  if (shelfId === moveToShelfId) {
    throw new HttpsError("invalid-argument", "Choose a different collection to move the books to.");
  }
  const { db } = deps;
  return db.runTransaction(async (tx) => {
    const shelf = await ownShelf(tx, db, shelfId, caller.uid);
    const target = await ownShelf(tx, db, moveToShelfId, caller.uid);
    const count = await tx.get(db.collection(COL.shelves).where("ownerId", "==", caller.uid).limit(2));
    if (count.size < 2) throw new HttpsError("failed-precondition", "You can't delete your last collection.");
    const items = await tx.get(
      db.collection(COL.items).where("ownerId", "==", caller.uid).where("shelfId", "==", shelfId),
    );
    if (items.size > MAX_ITEMS_PER_SHELF_OP) {
      throw new HttpsError("resource-exhausted", `This collection has more than ${MAX_ITEMS_PER_SHELF_OP} books; move some first.`);
    }
    const targetPublic = (target.data() as ShelfDoc).isPublic;
    const now = ts(deps.now());
    for (const d of items.docs) {
      const item = d.data() as ItemDoc;
      tx.update(d.ref, {
        shelfId: moveToShelfId,
        sharedWithContacts: computeSharedWithContacts(targetPublic, item.visibility),
        updatedAt: now,
      });
    }
    tx.delete(shelf.ref);
    return { moved: items.size };
  });
}
