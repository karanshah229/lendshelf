import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import type { Caller, Deps } from "../lib/context.js";
import { parseInput, precondition } from "../lib/errors.js";
import { isExpoPushToken, withPushToken } from "../lib/push.js";
import { COL, type UserDoc } from "../model.js";

export const pushTokenSchema = z.object({
  token: z.string().trim().max(200).refine(isExpoPushToken, "Not an Expo push token"),
});

/**
 * Register this device's Expo push token for the caller. A device belongs to
 * one account at a time, so the token is removed from any other user first
 * (e.g. after signing out and in as someone else). The caller keeps their 20
 * newest tokens; the oldest is dropped.
 */
export async function registerPushToken(deps: Deps, caller: Caller, data: unknown): Promise<{ ok: true }> {
  const { token } = parseInput(pushTokenSchema, data);
  const { db } = deps;
  const users = db.collection(COL.users);
  const userRef = users.doc(caller.uid);
  await db.runTransaction(async (tx) => {
    const [userSnap, holders] = await Promise.all([
      tx.get(userRef),
      tx.get(users.where("pushTokens", "array-contains", token)),
    ]);
    if (!userSnap.exists) throw precondition("Finish signing up first.");
    for (const h of holders.docs) {
      if (h.id !== caller.uid) tx.update(h.ref, { pushTokens: FieldValue.arrayRemove(token) });
    }
    const current = (userSnap.data() as Partial<UserDoc>).pushTokens;
    tx.update(userRef, { pushTokens: withPushToken(Array.isArray(current) ? current : [], token) });
  });
  return { ok: true };
}

/** Stop sending pushes for this device to the caller (e.g. on sign-out). */
export async function unregisterPushToken(deps: Deps, caller: Caller, data: unknown): Promise<{ ok: true }> {
  const { token } = parseInput(pushTokenSchema, data);
  const ref = deps.db.collection(COL.users).doc(caller.uid);
  const snap = await ref.get();
  if (snap.exists) await ref.update({ pushTokens: FieldValue.arrayRemove(token) });
  return { ok: true };
}
