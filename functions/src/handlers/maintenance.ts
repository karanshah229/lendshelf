import { logger } from "firebase-functions";
import { ts, type Deps } from "../lib/context.js";
import { reminderKind, requestExpiryCutoff } from "../lib/loans.js";
import { msg } from "../lib/messages.js";
import type { PushMessage } from "../lib/push.js";
import { COL, type LoanDoc } from "../model.js";

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
  const writer = db.bulkWriter();
  for (const d of stale.docs) {
    const loan = d.data() as LoanDoc;
    writer.update(d.ref, { status: "expired", updatedAt: ts(now) });
    if (loan.borrowerUid) pushes.push({ uids: [loan.borrowerUid], message: msg.requestExpired(loan.title, d.id) });
  }
  await writer.close();

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
      if (loan.borrowerUid) pushes.push({ uids: [loan.borrowerUid], message: msg.dueSoon(loan.title, d.id, due) });
    } else if (kind === "overdue") {
      overdue++;
      if (loan.borrowerUid) pushes.push({ uids: [loan.borrowerUid], message: msg.overdueBorrower(loan.title, d.id, due) });
      pushes.push({ uids: [loan.ownerId], message: msg.overdueOwner(loan.borrowerName, loan.title, d.id, due) });
    }
  }

  for (const p of pushes) {
    try {
      await deps.push(p.uids, p.message);
    } catch (err) {
      logger.warn("push failed", { error: String(err) });
    }
  }
  const result = { expired: stale.size, dueSoon, overdue };
  logger.info("dailyMaintenance", result);
  return result;
}
