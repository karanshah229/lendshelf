import * as logger from "firebase-functions/logger";
import { trackedBulkWriter } from "../lib/bulk.js";
import { ts, type Deps } from "../lib/context.js";
import { reminderKind, requestExpiryCutoff } from "../lib/loans.js";
import { msg } from "../lib/messages.js";
import { chunk, type PushMessage } from "../lib/push.js";
import { COL, linkId, type LoanDoc } from "../model.js";

export interface MaintenanceResult {
  expired: number;
  dueSoon: number;
  overdue: number;
}

/**
 * Daily job (09:00 Asia/Kolkata): expire week-old requests, send
 * "due in 2 days" and "overdue" reminders. Exported so tests can run it directly.
 */
export async function runDailyMaintenance(deps: Deps): Promise<MaintenanceResult> {
  const { db } = deps;
  const now = deps.now();
  const pushes: { uids: string[]; message: PushMessage }[] = [];

  const stale = await db
    .collection(COL.loans)
    .where("status", "==", "requested")
    .where("requestedAt", "<=", ts(requestExpiryCutoff(now)))
    .get();
  const writer = trackedBulkWriter(db);
  let expired = 0;
  for (const d of stale.docs) {
    const loan = d.data() as LoanDoc;
    // Precondition: only if the loan hasn't changed since we read it (e.g. the
    // owner accepted it in the meantime). A failed precondition just skips it.
    writer.update(d.ref, { status: "expired", updatedAt: ts(now) }, { lastUpdateTime: d.updateTime }).then(
      () => {
        expired++;
        if (loan.borrowerUid) pushes.push({ uids: [loan.borrowerUid], message: msg.requestExpired(loan.title, d.id) });
      },
      () => undefined,
    );
  }
  const failures = await writer.close();
  if (failures.length > 0) {
    logger.warn("dailyMaintenance: some requests weren't expired (changed meanwhile or write failed)", {
      failed: failures.length,
      sample: failures.slice(0, 5).map((f) => ({ path: f.path, error: String(f.error) })),
    });
  }

  // Reminders to the borrower go only to borrowers who have the owner saved
  // (a loan the owner recorded can name any app user's number).
  const borrowerReminders: { borrowerUid: string; ownerId: string; message: PushMessage }[] = [];
  let dueSoon = 0;
  let overdue = 0;
  const active = await db.collection(COL.loans).where("status", "==", "active").get();
  for (const d of active.docs) {
    const loan = d.data() as LoanDoc;
    if (!loan.dueDate) continue;
    const due = loan.dueDate.toDate();
    const kind = reminderKind(due, now);
    if (kind === "dueSoon") {
      dueSoon++;
      if (loan.borrowerUid) {
        borrowerReminders.push({ borrowerUid: loan.borrowerUid, ownerId: loan.ownerId, message: msg.dueSoon(loan.title, d.id, due, now) });
      }
    } else if (kind === "overdue") {
      overdue++;
      if (loan.borrowerUid) {
        borrowerReminders.push({ borrowerUid: loan.borrowerUid, ownerId: loan.ownerId, message: msg.overdueBorrower(loan.title, d.id, due) });
      }
      pushes.push({ uids: [loan.ownerId], message: msg.overdueOwner(loan.borrowerName, loan.title, d.id, due) });
    }
  }

  for (const part of chunk(borrowerReminders, 300)) {
    const links = await db.getAll(...part.map((r) => db.collection(COL.links).doc(linkId(r.borrowerUid, r.ownerId))));
    part.forEach((r, i) => {
      if (links[i]?.exists) pushes.push({ uids: [r.borrowerUid], message: r.message });
    });
  }

  for (const p of pushes) {
    try {
      await deps.push(p.uids, p.message);
    } catch (err) {
      logger.warn("push failed", { error: String(err) });
    }
  }
  const result = { expired, dueSoon, overdue };
  logger.info("dailyMaintenance", result);
  return result;
}
