import type { DocumentReference, Firestore, Transaction } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { z } from "zod";
import { ts, type Caller, type Deps } from "../lib/context.js";
import { denied, HttpsError, notFound, parseInput, precondition } from "../lib/errors.js";
import { assertActor, isRequestExpired, nextStatus, resolveDueDate } from "../lib/loans.js";
import { msg } from "../lib/messages.js";
import { normalisePhone } from "../lib/phone.js";
import type { PushMessage } from "../lib/push.js";
import {
  COL,
  linkId,
  type ItemDoc,
  type LoanDoc,
  type PhoneIndexDoc,
  type ProfileDoc,
  type UserDoc,
  type WatchDoc,
} from "../model.js";

const id = z.string().trim().min(1).max(200);
const isoDate = z.string().trim().min(8).max(40);

export const requestLoanSchema = z.object({
  itemId: id,
  message: z.string().trim().max(500, "Message must be at most 500 characters").nullable().optional(),
});
export const respondToRequestSchema = z.object({
  loanId: id,
  accept: z.boolean(),
  dueDate: isoDate.nullable().optional(),
});
export const loanIdSchema = z.object({ loanId: id });
export const recordLoanSchema = z.object({
  itemId: id,
  borrowerName: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Borrower name is required").max(60, "Borrower name must be at most 60 characters")),
  borrowerPhone: z.string().trim().max(40).nullable().optional(),
  dueDate: isoDate.nullable().optional(),
});
export const updateDueDateSchema = z.object({ loanId: id, dueDate: isoDate });

type Push = { uids: string[]; message: PushMessage };

async function sendAll(deps: Deps, pushes: Push[]): Promise<void> {
  for (const p of pushes) {
    try {
      await deps.push(p.uids, p.message);
    } catch (err) {
      logger.warn("push failed", { error: String(err) });
    }
  }
}

/** Name + phone for a user, read inside a transaction. */
async function person(tx: Transaction, db: Firestore, uid: string): Promise<{ name: string; phone: string | null }> {
  const [p, u] = await Promise.all([
    tx.get(db.collection(COL.profiles).doc(uid)),
    tx.get(db.collection(COL.users).doc(uid)),
  ]);
  const name = (p.data() as ProfileDoc | undefined)?.name ?? "Someone";
  const phone = (u.data() as UserDoc | undefined)?.phone || null;
  return { name, phone };
}

async function getLoan(tx: Transaction, db: Firestore, loanId: string): Promise<{ ref: DocumentReference; loan: LoanDoc }> {
  const ref = db.collection(COL.loans).doc(loanId);
  const snap = await tx.get(ref);
  if (!snap.exists) throw notFound("Loan");
  return { ref, loan: snap.data() as LoanDoc };
}

/** Borrower asks to borrow a contact's copy. */
export async function requestLoan(
  deps: Deps,
  caller: Caller,
  data: unknown,
): Promise<{ loanId: string; ownerPhone: string }> {
  const input = parseInput(requestLoanSchema, data);
  const { db } = deps;
  const uid = caller.uid;
  const loanRef = db.collection(COL.loans).doc();

  const result = await db.runTransaction(async (tx) => {
    const itemSnap = await tx.get(db.collection(COL.items).doc(input.itemId));
    if (!itemSnap.exists) throw notFound("Book");
    const item = itemSnap.data() as ItemDoc;
    if (item.ownerId === uid) throw precondition("You can't borrow your own book.");

    const [link, open, owner, borrower] = await Promise.all([
      tx.get(db.collection(COL.links).doc(linkId(uid, item.ownerId))),
      tx.get(
        db
          .collection(COL.loans)
          .where("itemId", "==", input.itemId)
          .where("borrowerUid", "==", uid)
          .where("status", "==", "requested")
          .limit(1),
      ),
      person(tx, db, item.ownerId),
      person(tx, db, uid),
    ]);
    if (!link.exists) throw denied("You can only borrow from people whose number you have saved.");
    if (!item.sharedWithContacts) throw notFound("Book");
    if (item.visibility !== "lendable") throw precondition("The owner isn't lending this copy.");
    if (item.loanState !== "available") throw precondition("This copy is lent out right now.");
    if (!open.empty) throw new HttpsError("already-exists", "You've already asked to borrow this copy.");

    const now = ts(deps.now());
    const ownerPhone = owner.phone ?? (link.data()?.ownerPhone as string | undefined) ?? "";
    const loan: LoanDoc = {
      itemId: input.itemId,
      workId: item.workId,
      ownerId: item.ownerId,
      ownerName: owner.name,
      ownerPhone,
      borrowerUid: uid,
      borrowerName: borrower.name,
      borrowerPhone: borrower.phone ?? caller.phone,
      title: item.title,
      coverUrl: item.coverUrl,
      status: "requested",
      message: input.message ? input.message : null,
      dueDate: null,
      requestedAt: now,
      startedAt: null,
      returnMarkedAt: null,
      returnedAt: null,
      updatedAt: now,
    };
    tx.create(loanRef, loan);
    return { loan, ownerPhone };
  });

  await sendAll(deps, [
    { uids: [result.loan.ownerId], message: msg.loanRequested(result.loan.borrowerName, result.loan.title, loanRef.id) },
  ]);
  return { loanId: loanRef.id, ownerPhone: result.ownerPhone };
}

/** Owner accepts or declines a request. Accepting declines other open requests for the copy. */
export async function respondToRequest(deps: Deps, caller: Caller, data: unknown): Promise<{ ok: true }> {
  const input = parseInput(respondToRequestSchema, data);
  const { db } = deps;
  const nowDate = deps.now();

  const outcome = await db.runTransaction(async (tx) => {
    const { ref, loan } = await getLoan(tx, db, input.loanId);
    assertActor(loan, caller.uid, input.accept ? "accept" : "decline");
    nextStatus(loan.status, input.accept ? "accept" : "decline");
    const now = ts(nowDate);
    const pushes: Push[] = [];

    if (loan.requestedAt && isRequestExpired(loan.requestedAt.toDate(), nowDate)) {
      tx.update(ref, { status: nextStatus(loan.status, "expire"), updatedAt: now });
      return { expired: true as const, pushes };
    }

    if (!input.accept) {
      tx.update(ref, { status: nextStatus(loan.status, "decline"), updatedAt: now });
      if (loan.borrowerUid) {
        pushes.push({ uids: [loan.borrowerUid], message: msg.requestDeclined(loan.ownerName, loan.title, input.loanId) });
      }
      return { expired: false as const, pushes };
    }

    const due = resolveDueDate(input.dueDate, nowDate);
    const itemRef = db.collection(COL.items).doc(loan.itemId);
    const [itemSnap, others] = await Promise.all([
      tx.get(itemRef),
      tx.get(db.collection(COL.loans).where("itemId", "==", loan.itemId).where("status", "==", "requested")),
    ]);
    if (!itemSnap.exists) throw notFound("Book");
    const item = itemSnap.data() as ItemDoc;
    if (item.loanState !== "available") throw precondition("This copy is already lent out. Confirm its return first.");

    tx.update(ref, {
      status: nextStatus(loan.status, "accept"),
      dueDate: ts(due),
      startedAt: now,
      updatedAt: now,
    });
    tx.update(itemRef, { loanState: "lent", activeLoanId: input.loanId, dueDate: ts(due), updatedAt: now });
    pushes.push({ uids: loan.borrowerUid ? [loan.borrowerUid] : [], message: msg.requestAccepted(loan.ownerName, loan.title, input.loanId, due) });
    for (const o of others.docs) {
      if (o.id === input.loanId) continue;
      const other = o.data() as LoanDoc;
      tx.update(o.ref, { status: "declined", updatedAt: now });
      if (other.borrowerUid) {
        pushes.push({ uids: [other.borrowerUid], message: msg.requestDeclined(other.ownerName, other.title, o.id) });
      }
    }
    return { expired: false as const, pushes };
  });

  if (outcome.expired) throw precondition("This request expired (requests last 7 days).");
  await sendAll(deps, outcome.pushes);
  return { ok: true };
}

/** Borrower withdraws a request. */
export async function cancelRequest(deps: Deps, caller: Caller, data: unknown): Promise<{ ok: true }> {
  const { loanId } = parseInput(loanIdSchema, data);
  const { db } = deps;
  await db.runTransaction(async (tx) => {
    const { ref, loan } = await getLoan(tx, db, loanId);
    assertActor(loan, caller.uid, "cancel");
    tx.update(ref, { status: nextStatus(loan.status, "cancel"), updatedAt: ts(deps.now()) });
  });
  return { ok: true };
}

/** Owner lends a copy directly, to an app user or anyone else. */
export async function recordLoan(deps: Deps, caller: Caller, data: unknown): Promise<{ loanId: string }> {
  const input = parseInput(recordLoanSchema, data);
  const { db } = deps;
  const nowDate = deps.now();
  const due = resolveDueDate(input.dueDate, nowDate);
  let borrowerPhone: string | null = null;
  if (input.borrowerPhone) {
    borrowerPhone = normalisePhone(input.borrowerPhone);
    if (!borrowerPhone) throw new HttpsError("invalid-argument", `"${input.borrowerPhone}" isn't a valid phone number.`);
  }
  const loanRef = db.collection(COL.loans).doc();

  const pushes = await db.runTransaction(async (tx) => {
    const itemRef = db.collection(COL.items).doc(input.itemId);
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists) throw notFound("Book");
    const item = itemSnap.data() as ItemDoc;
    if (item.ownerId !== caller.uid) throw denied("You can only lend your own books.");
    if (item.loanState !== "available") throw precondition("This copy is already lent out.");

    const [indexSnap, others, owner] = await Promise.all([
      borrowerPhone ? tx.get(db.collection(COL.phoneIndex).doc(borrowerPhone)) : Promise.resolve(null),
      tx.get(db.collection(COL.loans).where("itemId", "==", input.itemId).where("status", "==", "requested")),
      person(tx, db, caller.uid),
    ]);
    const borrowerUid = indexSnap?.exists ? (indexSnap.data() as PhoneIndexDoc).uid : null;
    if (borrowerUid === caller.uid) throw new HttpsError("invalid-argument", "You can't lend a book to yourself.");
    // Only push to a matched borrower who has the owner saved: otherwise anyone
    // could send pushes to any number on the app by "lending" to it.
    const borrowerHasOwner = borrowerUid
      ? (await tx.get(db.collection(COL.links).doc(linkId(borrowerUid, caller.uid)))).exists
      : false;

    const now = ts(nowDate);
    const loan: LoanDoc = {
      itemId: input.itemId,
      workId: item.workId,
      ownerId: caller.uid,
      ownerName: owner.name,
      ownerPhone: owner.phone ?? caller.phone ?? "",
      borrowerUid,
      borrowerName: input.borrowerName,
      borrowerPhone,
      title: item.title,
      coverUrl: item.coverUrl,
      status: "active",
      message: null,
      dueDate: ts(due),
      requestedAt: null,
      startedAt: now,
      returnMarkedAt: null,
      returnedAt: null,
      updatedAt: now,
    };
    tx.create(loanRef, loan);
    tx.update(itemRef, { loanState: "lent", activeLoanId: loanRef.id, dueDate: ts(due), updatedAt: now });

    const out: Push[] = [];
    if (borrowerUid && borrowerHasOwner) {
      out.push({ uids: [borrowerUid], message: msg.lentToYou(owner.name, item.title, loanRef.id, due) });
    }
    for (const o of others.docs) {
      const other = o.data() as LoanDoc;
      tx.update(o.ref, { status: "declined", updatedAt: now });
      if (other.borrowerUid) out.push({ uids: [other.borrowerUid], message: msg.requestDeclined(owner.name, item.title, o.id) });
    }
    return out;
  });

  await sendAll(deps, pushes);
  return { loanId: loanRef.id };
}

/** Borrower says they've given the book back. */
export async function markReturned(deps: Deps, caller: Caller, data: unknown): Promise<{ ok: true }> {
  const { loanId } = parseInput(loanIdSchema, data);
  const { db } = deps;
  const loan = await db.runTransaction(async (tx) => {
    const { ref, loan } = await getLoan(tx, db, loanId);
    assertActor(loan, caller.uid, "markReturned");
    const now = ts(deps.now());
    tx.update(ref, { status: nextStatus(loan.status, "markReturned"), returnMarkedAt: now, updatedAt: now });
    return loan;
  });
  await sendAll(deps, [{ uids: [loan.ownerId], message: msg.markedReturned(loan.borrowerName, loan.title, loanId) }]);
  return { ok: true };
}

/**
 * Owner confirms the book is back: item available. "Back" watchers are told
 * only if the copy is shared and they have the owner saved (they could see
 * it); all of the copy's "back" watches are then removed.
 */
export async function confirmReturn(deps: Deps, caller: Caller, data: unknown): Promise<{ ok: true }> {
  const { loanId } = parseInput(loanIdSchema, data);
  const { db } = deps;
  const loan = await db.runTransaction(async (tx) => {
    const { ref, loan } = await getLoan(tx, db, loanId);
    assertActor(loan, caller.uid, "confirmReturn");
    const itemRef = db.collection(COL.items).doc(loan.itemId);
    const itemSnap = await tx.get(itemRef);
    const now = ts(deps.now());
    tx.update(ref, { status: nextStatus(loan.status, "confirmReturn"), returnedAt: now, updatedAt: now });
    const item = itemSnap.data() as ItemDoc | undefined;
    if (item && item.activeLoanId === loanId) {
      tx.update(itemRef, { loanState: "available", activeLoanId: null, dueDate: null, updatedAt: now });
    }
    return { ...loan, shared: item?.sharedWithContacts === true };
  });

  const watches = await db
    .collection(COL.watches)
    .where("type", "==", "back")
    .where("targetId", "==", loan.itemId)
    .get();
  let watchers = loan.shared
    ? [...new Set(watches.docs.map((d) => (d.data() as WatchDoc).uid))].filter(
        (u) => u !== loan.borrowerUid && u !== loan.ownerId,
      )
    : [];
  if (watchers.length) {
    const links = await db.getAll(...watchers.map((u) => db.collection(COL.links).doc(linkId(u, loan.ownerId))));
    watchers = watchers.filter((_, i) => links[i]?.exists);
  }
  const pushes: Push[] = [];
  if (watchers.length) pushes.push({ uids: watchers, message: msg.itemBack(loan.ownerName, loan.title, loan.itemId) });
  // Review prompt only to a borrower who has the owner saved (see recordLoan).
  if (loan.borrowerUid && (await db.collection(COL.links).doc(linkId(loan.borrowerUid, loan.ownerId)).get()).exists) {
    pushes.push({ uids: [loan.borrowerUid], message: msg.reviewPrompt(loan.title, loan.workId, loanId) });
  }
  await sendAll(deps, pushes);
  if (!watches.empty) {
    const batch = db.batch();
    watches.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  return { ok: true };
}

/** Owner changes the due date of an active loan. */
export async function updateDueDate(deps: Deps, caller: Caller, data: unknown): Promise<{ ok: true }> {
  const input = parseInput(updateDueDateSchema, data);
  const { db } = deps;
  const nowDate = deps.now();
  const due = resolveDueDate(input.dueDate, nowDate);
  await db.runTransaction(async (tx) => {
    const { ref, loan } = await getLoan(tx, db, input.loanId);
    assertActor(loan, caller.uid, "updateDueDate");
    nextStatus(loan.status, "updateDueDate");
    const itemRef = db.collection(COL.items).doc(loan.itemId);
    const itemSnap = await tx.get(itemRef);
    const now = ts(nowDate);
    tx.update(ref, { dueDate: ts(due), updatedAt: now });
    if (itemSnap.exists && (itemSnap.data() as ItemDoc).activeLoanId === input.loanId) {
      tx.update(itemRef, { dueDate: ts(due), updatedAt: now });
    }
  });
  return { ok: true };
}
