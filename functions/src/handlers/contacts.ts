import { z } from "zod";
import { ts, type Caller, type Deps } from "../lib/context.js";
import { parseInput } from "../lib/errors.js";
import { normalisePhone } from "../lib/phone.js";
import { chunk } from "../lib/push.js";
import { COL, linkId, type LinkDoc, type PhoneIndexDoc, type ProfileDoc } from "../model.js";

export const syncContactsSchema = z.object({
  phones: z.array(z.string().max(40)).max(5000, "At most 5000 phone numbers per sync"),
});

export interface SyncedLink {
  ownerId: string;
  ownerPhone: string;
  /** Profile name, or null if they haven't finished sign-up. */
  name: string | null;
}

/**
 * Replace the caller's links with the app users found among `phones`.
 * One-way: only `links/{caller}_{owner}` docs are written. The phone list
 * itself is never stored.
 */
export async function syncContacts(deps: Deps, caller: Caller, data: unknown): Promise<{ links: SyncedLink[] }> {
  const { phones } = parseInput(syncContactsSchema, data);
  const { db } = deps;
  const uid = caller.uid;

  const normalised = [...new Set(phones.map((p) => normalisePhone(p)).filter((p): p is string => p !== null))];

  // phone -> owner uid
  const matches = new Map<string, string>();
  for (const part of chunk(normalised, 300)) {
    const snaps = await db.getAll(...part.map((p) => db.collection(COL.phoneIndex).doc(p)));
    for (const s of snaps) {
      if (!s.exists) continue;
      const owner = (s.data() as PhoneIndexDoc).uid;
      if (owner && owner !== uid) matches.set(owner, s.id);
    }
  }

  const existing = await db.collection(COL.links).where("viewerId", "==", uid).get();
  const now = ts(deps.now());
  const writer = db.bulkWriter();
  const existingOwners = new Set<string>();
  for (const d of existing.docs) {
    const link = d.data() as LinkDoc;
    existingOwners.add(link.ownerId);
    const phone = matches.get(link.ownerId);
    if (phone === undefined) writer.delete(d.ref);
    else if (phone !== link.ownerPhone) writer.update(d.ref, { ownerPhone: phone });
  }
  for (const [ownerId, ownerPhone] of matches) {
    if (existingOwners.has(ownerId)) continue;
    const link: LinkDoc = { viewerId: uid, ownerId, ownerPhone, createdAt: now };
    writer.set(db.collection(COL.links).doc(linkId(uid, ownerId)), link);
  }
  await writer.close();

  const owners = [...matches.keys()];
  const names = new Map<string, string>();
  for (const part of chunk(owners, 300)) {
    if (part.length === 0) continue;
    const snaps = await db.getAll(...part.map((o) => db.collection(COL.profiles).doc(o)));
    for (const s of snaps) {
      const name = (s.data() as ProfileDoc | undefined)?.name;
      if (name) names.set(s.id, name);
    }
  }

  const links = owners
    .map((ownerId) => ({ ownerId, ownerPhone: matches.get(ownerId) as string, name: names.get(ownerId) ?? null }))
    .sort((a, b) => (a.name ?? "￿").localeCompare(b.name ?? "￿"));
  return { links };
}
