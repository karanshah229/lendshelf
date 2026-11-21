import { type DocumentReference, type Firestore, type Query } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { z } from "zod";
import { trackedBulkWriter } from "../lib/bulk.js";
import { ts, type Caller, type Deps } from "../lib/context.js";
import { HttpsError, parseInput } from "../lib/errors.js";
import { canTransition } from "../lib/loans.js";
import { msg } from "../lib/messages.js";
import { normalisePhone } from "../lib/phone.js";
import type { PushMessage } from "../lib/push.js";
import {
  COL,
  DEFAULT_SHELF_NAME,
  defaultShelfId,
  linkId,
  type LoanDoc,
  type ProfileDoc,
  type ShelfDoc,
  type UserDoc,
} from "../model.js";

/**
 * Create `users/{uid}`, `phoneIndex/{phone}` and the default shelf if they
 * don't exist. Safe to call repeatedly (auth trigger + completeProfile).
 */
export async function ensureUserBootstrap(deps: Deps, uid: string, phoneRaw: string | null): Promise<void> {
  const { db } = deps;
  const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
  const now = ts(deps.now());
  const userRef = db.collection(COL.users).doc(uid);
  const shelfRef = db.collection(COL.shelves).doc(defaultShelfId(uid));
  await db.runTransaction(async (tx) => {
    const [userSnap, shelfSnap, anyShelf] = await Promise.all([
      tx.get(userRef),
      tx.get(shelfRef),
      tx.get(db.collection(COL.shelves).where("ownerId", "==", uid).limit(1)),
    ]);
    const phoneSnap = phone ? await tx.get(db.collection(COL.phoneIndex).doc(phone)) : null;

    if (!userSnap.exists) {
      const user: UserDoc = { phone: phone ?? "", pushTokens: [], createdAt: now };
      tx.set(userRef, user);
    } else if (phone && (userSnap.data() as UserDoc).phone !== phone) {
      tx.update(userRef, { phone });
    }
    if (phone && phoneSnap && (!phoneSnap.exists || phoneSnap.data()?.uid !== uid)) {
      tx.set(phoneSnap.ref, { uid });
    }
    if (!shelfSnap.exists && anyShelf.empty) {
      const shelf: ShelfDoc = {
        ownerId: uid,
        name: DEFAULT_SHELF_NAME,
        isPublic: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(shelfRef, shelf);
    }
  });
}

/** Auth trigger body: bootstrap the account. */
export async function onUserCreatedHandler(
  deps: Deps,
  user: { uid: string; phoneNumber?: string | null },
): Promise<void> {
  await ensureUserBootstrap(deps, user.uid, user.phoneNumber ?? null);
}

/** Caller's phone: the ID token claim, else the Auth record. */
export async function callerPhone(deps: Deps, caller: Caller): Promise<string | null> {
  if (caller.phone) return caller.phone;
  try {
    const u = await deps.auth.getUser(caller.uid);
    return u.phoneNumber ?? null;
  } catch {
    return null;
  }
}

export const completeProfileSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Name is required").max(60, "Name must be at most 60 characters")),
  pickupNote: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(200, "Pickup note must be at most 200 characters"))
    .nullable()
    .optional(),
});

export async function completeProfile(deps: Deps, caller: Caller, data: unknown): Promise<{ ok: true }> {
  const input = parseInput(completeProfileSchema, data);
  const phone = await callerPhone(deps, caller);
  if (!phone) throw new HttpsError("failed-precondition", "Sign in with your phone number first.");
  await ensureUserBootstrap(deps, caller.uid, phone);

  const ref = deps.db.collection(COL.profiles).doc(caller.uid);
  const now = ts(deps.now());
  await deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const pickupNote = input.pickupNote === undefined ? undefined : input.pickupNote === "" ? null : input.pickupNote;
    if (snap.exists) {
      const patch: Partial<ProfileDoc> = { name: input.name, updatedAt: now };
      if (pickupNote !== undefined) patch.pickupNote = pickupNote;
      tx.update(ref, patch);
    } else {
      const profile: ProfileDoc = {
        name: input.name,
        pickupNote: pickupNote ?? null,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(ref, profile);
    }
  });
  return { ok: true };
}

// ---- deleteAccount ------------------------------------------------------------

async function refsOf(q: Query): Promise<DocumentReference[]> {
  return (await q.get()).docs.map((d) => d.ref);
}

export interface DeleteAccountResult {
  ok: true;
  deleted: Record<string, number>;
}

/**
 * Remove everything belonging to the caller. Loans they own are closed (and
 * kept for the borrower's history without the owner's phone): requests are
 * cancelled, books still out become `ownerLeft`. Loans they borrowed keep
 * the borrower name but lose `borrowerUid`.
 */
export async function deleteAccount(deps: Deps, caller: Caller): Promise<DeleteAccountResult> {
  const { db } = deps;
  const uid = caller.uid;
  const now = ts(deps.now());
  const counts: Record<string, number> = {};
  const writer = trackedBulkWriter(db);

  // Loans they own: close them. A book still out with an app borrower becomes
  // `ownerLeft` (name kept, phone blanked) and the borrower is told once, if
  // they have the owner saved (DECISIONS #23). Pushes are queued only for
  // writes that landed, so a retried deletion doesn't repeat them.
  const ownedLoans = await db.collection(COL.loans).where("ownerId", "==", uid).get();
  const ownerLeftPushes: { uids: string[]; message: PushMessage }[] = [];
  counts.loansClosed = 0;
  counts.loansOwnerLeft = 0;
  for (const d of ownedLoans.docs) {
    const loan = d.data() as LoanDoc;
    if (loan.borrowerUid === null) {
      writer.delete(d.ref);
    } else {
      const patch: Record<string, unknown> = { ownerPhone: "", updatedAt: now };
      if (loan.status === "requested") patch.status = "cancelled";
      const leaving = canTransition(loan.status, "ownerLeave");
      if (leaving) {
        patch.status = "ownerLeft";
        counts.loansOwnerLeft++;
      }
      const borrowerUid = loan.borrowerUid;
      const tell =
        leaving && (await db.collection(COL.links).doc(linkId(borrowerUid, uid)).get()).exists;
      writer.update(d.ref, patch).then(
        () => {
          if (tell) ownerLeftPushes.push({ uids: [borrowerUid], message: msg.ownerLeft(loan.ownerName, loan.title, d.id) });
        },
        () => undefined,
      );
    }
    counts.loansClosed++;
  }

  // Loans they borrowed: drop the uid, keep the name.
  const borrowed = await db.collection(COL.loans).where("borrowerUid", "==", uid).get();
  for (const d of borrowed.docs) {
    const loan = d.data() as LoanDoc;
    // borrowerLeftAt: the owner sees "Zoya left LendShelf" rather than a hand-recorded loan.
    const patch: Record<string, unknown> = { borrowerUid: null, borrowerLeftAt: now, updatedAt: now };
    if (loan.status === "requested") patch.status = "cancelled";
    writer.update(d.ref, patch);
  }
  counts.loansAnonymised = borrowed.size;

  // Items, and other people's "back" watches on them.
  const items = await db.collection(COL.items).where("ownerId", "==", uid).get();
  const itemIds = items.docs.map((d) => d.id);
  for (const d of items.docs) writer.delete(d.ref);
  counts.items = items.size;
  let backWatches = 0;
  for (let i = 0; i < itemIds.length; i += 30) {
    const ids = itemIds.slice(i, i + 30);
    const refs = await refsOf(
      db.collection(COL.watches).where("type", "==", "back").where("targetId", "in", ids),
    );
    refs.forEach((r) => writer.delete(r));
    backWatches += refs.length;
  }
  counts.othersBackWatches = backWatches;

  const simple: [string, Query][] = [
    ["shelves", db.collection(COL.shelves).where("ownerId", "==", uid)],
    ["reviews", db.collection(COL.reviews).where("authorId", "==", uid)],
    ["watches", db.collection(COL.watches).where("uid", "==", uid)],
    ["linksAsViewer", db.collection(COL.links).where("viewerId", "==", uid)],
    ["linksAsOwner", db.collection(COL.links).where("ownerId", "==", uid)],
    ["customWorks", db.collection(COL.works).where("createdBy", "==", uid)],
  ];
  for (const [name, q] of simple) {
    const refs = await refsOf(q);
    refs.forEach((r) => writer.delete(r));
    counts[name] = refs.length;
  }

  // Phone index: from the users doc and the token/auth record.
  const userSnap = await db.collection(COL.users).doc(uid).get();
  const phones = new Set<string>();
  const storedPhone = (userSnap.data() as UserDoc | undefined)?.phone;
  if (storedPhone) phones.add(storedPhone);
  const authPhone = await callerPhone(deps, caller);
  if (authPhone) phones.add(authPhone);
  for (const p of phones) {
    const ref = db.collection(COL.phoneIndex).doc(p);
    const snap = await ref.get();
    if (snap.exists && snap.data()?.uid === uid) writer.delete(ref);
  }

  writer.delete(db.collection(COL.profiles).doc(uid));
  writer.delete(db.collection(COL.rateLimits).doc(uid));
  writer.delete(userSnap.ref);
  const failures = await writer.close();
  for (const p of ownerLeftPushes) {
    try {
      await deps.push(p.uids, p.message);
    } catch (err) {
      logger.warn("push failed", { error: String(err) });
    }
  }
  if (failures.length > 0) {
    // Keep the Auth user so the user can simply try again (every step above is repeatable).
    logger.error("deleteAccount: some writes failed", {
      uid,
      failed: failures.length,
      sample: failures.slice(0, 5).map((f) => ({ path: f.path, error: String(f.error) })),
    });
    throw new HttpsError("internal", "Some of your data couldn't be deleted. Please try deleting your account again.");
  }

  await deps.deleteUserFiles(uid);
  try {
    await deps.auth.deleteUser(uid);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/user-not-found") throw err;
  }
  logger.info("Account deleted", { uid, counts });
  return { ok: true, deleted: counts };
}

/** Exposed for tests that need to wait for the trigger. */
export async function userBootstrapExists(db: Firestore, uid: string): Promise<boolean> {
  const [u, s] = await Promise.all([
    db.collection(COL.users).doc(uid).get(),
    db.collection(COL.shelves).where("ownerId", "==", uid).limit(1).get(),
  ]);
  return u.exists && !s.empty;
}

