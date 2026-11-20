import type { Visibility } from "../model.js";

/** `items.sharedWithContacts` is derived: the shelf is public and the copy isn't hidden. */
export function computeSharedWithContacts(shelfIsPublic: boolean, visibility: Visibility): boolean {
  return shelfIsPublic && visibility !== "hidden";
}
