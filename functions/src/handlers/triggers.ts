import { logger } from "firebase-functions";
import { COL, linkId, type ItemDoc, type LoanDoc, type ProfileDoc, type WatchDoc } from "../model.js";
import { ts, type Deps } from "../lib/context.js";
import { msg } from "../lib/messages.js";

/** True when a write makes the copy newly visible to contacts. */
export function becameShared(before: ItemDoc | undefined, after: ItemDoc | undefined): boolean {
  return !!after?.sharedWithContacts && !before?.sharedWithContacts;
}

/**
 * When a copy is deleted, cancel its open borrow requests and tell the
 * borrowers. Each loan is updated in a transaction that re-checks the status,
 * so a request accepted or declined meanwhile is left alone. Returns the
 * notified uids.
 *
 * Triggers can run seconds late, so the copy is read again first: if it
 * exists again under the same id (deleted and rewritten meanwhile), its
 * requests are left alone (QA B5). `event.time` can't be used instead: the
 * test emulator sets it at dispatch time, to the second.
 */
export async function cancelRequestsForDeletedItem(deps: Deps, itemId: string): Promise<string[]> {
  const { db } = deps;
  const open = await db
    .collection(COL.loans)
    .where("itemId", "==", itemId)
    .where("status", "==", "requested")
    .get();
  const itemRef = db.collection(COL.items).doc(itemId);
  const notified: string[] = [];
  for (const d of open.docs) {
    try {
      const loan = await db.runTransaction(async (tx) => {
        const [snap, itemSnap] = await Promise.all([tx.get(d.ref), tx.get(itemRef)]);
        const current = snap.data() as LoanDoc | undefined;
        if (!current || current.status !== "requested") return null;
        if (itemSnap.exists) return null;
        // closedReason: Recent says "copy removed", not "Kabir cancelled" (QA B16).
        tx.update(d.ref, { status: "cancelled", closedReason: "copyRemoved", updatedAt: ts(deps.now()) });
        return current;
      });
      if (loan?.borrowerUid) {
        await deps.push([loan.borrowerUid], msg.itemRemoved(loan.ownerName, loan.title, d.id));
        notified.push(loan.borrowerUid);
      }
    } catch (err) {
      logger.warn("Cancelling a request for a deleted copy failed", { loanId: d.id, error: String(err) });
    }
  }
  return notified;
}

/**
 * When a copy becomes shared, notify users with a wishlist watch on its Book
 * who have the owner saved. When a copy is deleted, cancel its open requests.
 * Returns the notified uids.
 */
export async function onItemWrittenHandler(
  deps: Deps,
  itemId: string,
  before: ItemDoc | undefined,
  after: ItemDoc | undefined,
): Promise<string[]> {
  if (before && !after) return cancelRequestsForDeletedItem(deps, itemId);
  if (!after || !becameShared(before, after)) return [];
  const { db } = deps;
  const watches = await db
    .collection(COL.watches)
    .where("type", "==", "wishlist")
    .where("targetId", "==", after.workId)
    .get();
  const candidates = [
    ...new Set(watches.docs.map((d) => (d.data() as WatchDoc).uid).filter((u) => u !== after.ownerId)),
  ];
  if (candidates.length === 0) return [];
  const links = await db.getAll(...candidates.map((u) => db.collection(COL.links).doc(linkId(u, after.ownerId))));
  const recipients = candidates.filter((_, i) => links[i]?.exists);
  if (recipients.length === 0) return [];
  const profile = await db.collection(COL.profiles).doc(after.ownerId).get();
  const ownerName = (profile.data() as ProfileDoc | undefined)?.name ?? "A contact";
  await deps.push(recipients, msg.wishlistAdded(ownerName, after.title, itemId, after.workId));
  return recipients;
}
