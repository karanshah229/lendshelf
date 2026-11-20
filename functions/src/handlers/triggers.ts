import { COL, linkId, type ItemDoc, type ProfileDoc, type WatchDoc } from "../model.js";
import type { Deps } from "../lib/context.js";
import { msg } from "../lib/messages.js";

/** True when a write makes the copy newly visible to contacts. */
export function becameShared(before: ItemDoc | undefined, after: ItemDoc | undefined): boolean {
  return !!after?.sharedWithContacts && !before?.sharedWithContacts;
}

/**
 * When a copy becomes shared, notify users with a wishlist watch on its Book
 * who have the owner saved. Returns the notified uids.
 */
export async function onItemWrittenHandler(
  deps: Deps,
  itemId: string,
  before: ItemDoc | undefined,
  after: ItemDoc | undefined,
): Promise<string[]> {
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
