import type { DocumentReference } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { z } from "zod";
import { trackedBulkWriter } from "../lib/bulk.js";
import { ts, type Caller, type Deps } from "../lib/context.js";
import { parseInput } from "../lib/errors.js";
import { normalisePhone } from "../lib/phone.js";
import { chunk } from "../lib/push.js";
import { consumeQuota, SYNC_CONTACTS_QUOTA } from "../lib/rateLimit.js";
import { COL, linkId, type LinkDoc, type PhoneIndexDoc, type ProfileDoc } from "../model.js";

export const syncContactsSchema = z.object({
  phones: z.array(z.string().max(40)).max(5000, "At most 5000 phone numbers per sync"),
  /** Allow removing more than half of the existing links (a deliberate "Sync now"). */
  replace: z.boolean().optional(),
});

export interface SyncedLink {
  ownerId: string;
  ownerPhone: string;
  /** Profile name, or null if they haven't finished sign-up. */
  name: string | null;
}

export interface SyncContactsResult {
  /** The caller's links after the sync (matches, plus any kept by the shrink guard). */
  links: SyncedLink[];
  /** Links that would have been removed but were kept by the shrink guard (0 normally). */
  skippedRemovals: number;
}

/**
 * Replace the caller's links with the app users found among `phones`.
 * One-way: only `links/{caller}_{owner}` docs are written. The phone list
 * itself is never stored. Limited to 20 calls per user per rolling 24 hours
 * (phone-number probing), counted in `rateLimits/{uid}`.
 *
 * Shrink guard: without `replace: true`, a sync that would remove more than
 * half of the existing links (e.g. a half-restored address book on a new
 * phone) still adds and updates matches but removes nothing, and reports the
 * number kept as `skippedRemovals`.
 */
export async function syncContacts(deps: Deps, caller: Caller, data: unknown): Promise<SyncContactsResult> {
  const { phones, replace } = parseInput(syncContactsSchema, data);
  const { db } = deps;
  const uid = caller.uid;
  await consumeQuota(db, uid, SYNC_CONTACTS_QUOTA, deps.now());

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
  const writer = trackedBulkWriter(db);
  const existingOwners = new Set<string>();
  const removals: { ref: DocumentReference; link: LinkDoc }[] = [];
  for (const d of existing.docs) {
    const link = d.data() as LinkDoc;
    existingOwners.add(link.ownerId);
    const phone = matches.get(link.ownerId);
    if (phone === undefined) removals.push({ ref: d.ref, link });
    else if (phone !== link.ownerPhone) writer.update(d.ref, { ownerPhone: phone });
  }
  const guarded = replace !== true && removals.length * 2 > existing.size;
  const kept = guarded ? removals.map((r) => r.link) : [];
  if (guarded) {
    logger.info("syncContacts: shrink guard kept links", { uid, existing: existing.size, skippedRemovals: removals.length });
  } else {
    removals.forEach((r) => writer.delete(r.ref));
  }
  for (const [ownerId, ownerPhone] of matches) {
    if (existingOwners.has(ownerId)) continue;
    const link: LinkDoc = { viewerId: uid, ownerId, ownerPhone, createdAt: now };
    writer.set(db.collection(COL.links).doc(linkId(uid, ownerId)), link);
  }
  const failures = await writer.close();
  if (failures.length > 0) {
    logger.error("syncContacts: some link writes failed", {
      uid,
      failed: failures.length,
      sample: failures.slice(0, 5).map((f) => ({ path: f.path, error: String(f.error) })),
    });
  }

  const phoneOf = new Map(matches);
  for (const k of kept) phoneOf.set(k.ownerId, k.ownerPhone);
  const owners = [...phoneOf.keys()];
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
    .map((ownerId) => ({ ownerId, ownerPhone: phoneOf.get(ownerId) as string, name: names.get(ownerId) ?? null }))
    .sort((a, b) => (a.name ?? "￿").localeCompare(b.name ?? "￿"));
  return { links, skippedRemovals: kept.length };
}
