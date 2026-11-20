/**
 * Simple per-user quotas kept in `rateLimits/{uid}` (backend only; the rules
 * deny clients). Each key holds the timestamps of recent calls.
 */
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "./errors.js";
import { COL } from "../model.js";

export interface Quota {
  /** Field in `rateLimits/{uid}`, e.g. "syncContacts". */
  key: string;
  limit: number;
  windowMs: number;
}

export const SYNC_CONTACTS_QUOTA: Quota = { key: "syncContacts", limit: 20, windowMs: 24 * 60 * 60 * 1000 };

/** Calls still inside the window plus this one, or null when the quota is used up. */
export function takeFromWindow(previous: readonly number[], nowMs: number, quota: Quota): number[] | null {
  const recent = previous.filter((t) => t > nowMs - quota.windowMs && t <= nowMs).sort((a, b) => a - b);
  if (recent.length >= quota.limit) return null;
  return [...recent, nowMs];
}

/** Record one call for `uid`, or throw `resource-exhausted` when over the quota. */
export async function consumeQuota(db: Firestore, uid: string, quota: Quota, now: Date): Promise<void> {
  const ref = db.collection(COL.rateLimits).doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const raw = snap.get(quota.key) as unknown;
    const previous = Array.isArray(raw)
      ? raw.filter((t): t is Timestamp => t instanceof Timestamp).map((t) => t.toMillis())
      : [];
    const next = takeFromWindow(previous, now.getTime(), quota);
    if (!next) {
      throw new HttpsError("resource-exhausted", "Too many requests. Please try again tomorrow.");
    }
    tx.set(ref, { [quota.key]: next.map((ms) => Timestamp.fromMillis(ms)) }, { merge: true });
  });
}
