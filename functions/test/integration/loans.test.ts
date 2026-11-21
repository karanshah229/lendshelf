import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addItem,
  addShelf,
  adminAuth,
  cleanupClients,
  clearEmulators,
  clearPushes,
  createUser,
  db,
  ensureWork,
  expectCode,
  getDoc,
  nextPhone,
  pushesTo,
  WORK,
  type TestUser,
} from "./helpers.js";
import { COL, watchId, type ItemDoc, type LoanDoc, type WatchDoc } from "../../src/model.js";
import { Timestamp } from "firebase-admin/firestore";
import { runDailyMaintenance } from "../../src/handlers/maintenance.js";
import type { Deps } from "../../src/lib/context.js";
import { shortDate } from "../../src/lib/loans.js";
import type { PushMessage } from "../../src/lib/push.js";

let asha: TestUser; // owner
let ravi: TestUser; // has Asha saved
let meera: TestUser; // has Asha saved
let kabir: TestUser; // has nobody saved

const DAY = 86_400_000;

beforeAll(async () => {
  await clearEmulators();
  await ensureWork();
  [asha, ravi, meera, kabir] = (await Promise.all([
    createUser(nextPhone(), "Asha Rao"),
    createUser(nextPhone(), "Ravi Menon"),
    createUser(nextPhone(), "Meera Iyer"),
    createUser(nextPhone(), "Kabir Shah"),
  ])) as [TestUser, TestUser, TestUser, TestUser];
  await ravi.call("syncContacts", { phones: [asha.phone, meera.phone] });
  await meera.call("syncContacts", { phones: [asha.phone] });
});
afterAll(async () => {
  await cleanupClients();
});
beforeEach(async () => {
  await clearPushes();
});

type RequestRes = { loanId: string; ownerPhone: string };

describe("request -> accept -> markReturned -> confirmReturn", () => {
  it("walks the happy path with item state, pushes and back-watches", async () => {
    const itemId = await addItem(asha.uid);

    const req = await ravi.call<RequestRes>("requestLoan", { itemId, message: "Can I borrow this for my trip?" });
    expect(req.ownerPhone).toBe(asha.phone);
    let loan = await getDoc<LoanDoc>(COL.loans, req.loanId);
    expect(loan).toMatchObject({
      itemId,
      workId: WORK.id,
      ownerId: asha.uid,
      ownerName: "Asha Rao",
      ownerPhone: asha.phone,
      borrowerUid: ravi.uid,
      borrowerName: "Ravi Menon",
      borrowerPhone: ravi.phone,
      title: "The Hobbit",
      status: "requested",
      message: "Can I borrow this for my trip?",
      dueDate: null,
    });
    expect((await pushesTo(asha.uid)).map((p) => p.body)).toEqual(["Ravi Menon would like to borrow The Hobbit."]);

    // Meera asks too, and wants to know when it's back.
    const req2 = await meera.call<RequestRes>("requestLoan", { itemId });
    await db.collection(COL.watches).doc(watchId(meera.uid, "back", itemId)).set({
      uid: meera.uid, type: "back", targetId: itemId, workId: WORK.id, title: "The Hobbit", createdAt: Timestamp.now(),
    } satisfies WatchDoc);

    // Accept Ravi's with an explicit due date -> Meera's is declined.
    const due = new Date(Date.now() + 14 * DAY).toISOString();
    await expect(asha.call("respondToRequest", { loanId: req.loanId, accept: true, dueDate: due })).resolves.toEqual({ ok: true });
    loan = await getDoc<LoanDoc>(COL.loans, req.loanId);
    expect(loan?.status).toBe("active");
    expect(loan?.dueDate?.toDate().toISOString()).toBe(due);
    expect(loan?.startedAt).not.toBeNull();
    let item = await getDoc<ItemDoc>(COL.items, itemId);
    expect(item).toMatchObject({ loanState: "lent", activeLoanId: req.loanId });
    expect(item?.dueDate?.toDate().toISOString()).toBe(due);
    expect((await getDoc<LoanDoc>(COL.loans, req2.loanId))?.status).toBe("declined");
    expect((await pushesTo(ravi.uid)).map((p) => p.title)).toEqual(["Request accepted"]);
    expect((await pushesTo(meera.uid)).map((p) => p.title)).toEqual(["Request declined"]);

    // Lent: nobody else can ask.
    await expectCode(meera.call("requestLoan", { itemId }), "failed-precondition", /lent out/);

    // Owner changes the due date.
    const due2 = new Date(Date.now() + 30 * DAY).toISOString();
    await asha.call("updateDueDate", { loanId: req.loanId, dueDate: due2 });
    expect((await getDoc<LoanDoc>(COL.loans, req.loanId))?.dueDate?.toDate().toISOString()).toBe(due2);
    expect((await getDoc<ItemDoc>(COL.items, itemId))?.dueDate?.toDate().toISOString()).toBe(due2);
    await expectCode(ravi.call("updateDueDate", { loanId: req.loanId, dueDate: due2 }), "permission-denied");

    // Borrower marks it returned.
    await expectCode(asha.call("markReturned", { loanId: req.loanId }), "permission-denied", /Only the borrower/);
    await ravi.call("markReturned", { loanId: req.loanId });
    loan = await getDoc<LoanDoc>(COL.loans, req.loanId);
    expect(loan?.status).toBe("returnPending");
    expect(loan?.returnMarkedAt).not.toBeNull();
    expect((await pushesTo(asha.uid)).map((p) => p.title)).toContain("Book returned?");
    await expectCode(ravi.call("markReturned", { loanId: req.loanId }), "failed-precondition");

    // Owner confirms.
    await expectCode(ravi.call("confirmReturn", { loanId: req.loanId }), "permission-denied");
    await asha.call("confirmReturn", { loanId: req.loanId });
    loan = await getDoc<LoanDoc>(COL.loans, req.loanId);
    expect(loan?.status).toBe("returned");
    expect(loan?.returnedAt).not.toBeNull();
    item = await getDoc<ItemDoc>(COL.items, itemId);
    expect(item).toMatchObject({ loanState: "available", activeLoanId: null, dueDate: null });
    expect((await pushesTo(meera.uid)).map((p) => p.title)).toContain("Book is back");
    expect(await getDoc(COL.watches, watchId(meera.uid, "back", itemId))).toBeUndefined();
    const reviewPush = (await pushesTo(ravi.uid)).find((p) => p.title === "How was it?");
    expect(reviewPush?.data).toMatchObject({ type: "reviewPrompt", workId: WORK.id });
  });
});

describe("decline and cancel", () => {
  it("owner declines a request", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId } = await ravi.call<RequestRes>("requestLoan", { itemId });
    await expectCode(ravi.call("respondToRequest", { loanId, accept: false }), "permission-denied", /Only the owner/);
    await asha.call("respondToRequest", { loanId, accept: false });
    expect((await getDoc<LoanDoc>(COL.loans, loanId))?.status).toBe("declined");
    expect((await getDoc<ItemDoc>(COL.items, itemId))?.loanState).toBe("available");
    expect((await pushesTo(ravi.uid)).map((p) => p.title)).toEqual(["Request declined"]);
    await expectCode(asha.call("respondToRequest", { loanId, accept: true }), "failed-precondition", /already declined/);
    // Ravi can ask again after a decline.
    await ravi.call<RequestRes>("requestLoan", { itemId });
  });

  it("borrower cancels a request", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId } = await ravi.call<RequestRes>("requestLoan", { itemId });
    await expectCode(ravi.call("requestLoan", { itemId }), "already-exists");
    await expectCode(asha.call("cancelRequest", { loanId }), "permission-denied");
    await expectCode(meera.call("cancelRequest", { loanId }), "permission-denied", /isn't your loan/);
    await expect(ravi.call("cancelRequest", { loanId })).resolves.toEqual({ ok: true });
    expect((await getDoc<LoanDoc>(COL.loans, loanId))?.status).toBe("cancelled");
    await expectCode(ravi.call("cancelRequest", { loanId }), "failed-precondition");
    await expectCode(asha.call("respondToRequest", { loanId, accept: true }), "failed-precondition");
  });

  it("an expired request can't be accepted", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId } = await ravi.call<RequestRes>("requestLoan", { itemId });
    await db.collection(COL.loans).doc(loanId).update({ requestedAt: Timestamp.fromMillis(Date.now() - 8 * DAY) });
    await expectCode(asha.call("respondToRequest", { loanId, accept: true }), "failed-precondition", /expired/);
    expect((await getDoc<LoanDoc>(COL.loans, loanId))?.status).toBe("expired");
  });
});

describe("requestLoan guards", () => {
  it("requires the owner to be saved, the copy shared, lendable and available", async () => {
    const lendable = await addItem(asha.uid);
    await expectCode(kabir.call("requestLoan", { itemId: lendable }), "permission-denied", /number you have saved/);
    await expectCode(asha.call("requestLoan", { itemId: lendable }), "failed-precondition", /your own/);
    const visibleOnly = await addItem(asha.uid, { visibility: "visible" });
    await expectCode(ravi.call("requestLoan", { itemId: visibleOnly }), "failed-precondition", /isn't lending/);
    const hidden = await addItem(asha.uid, { visibility: "hidden" });
    await expectCode(ravi.call("requestLoan", { itemId: hidden }), "not-found");
    const privShelf = await addShelf(asha.uid, "Private", false);
    const onPrivate = await addItem(asha.uid, { shelfId: privShelf });
    await expectCode(ravi.call("requestLoan", { itemId: onPrivate }), "not-found");
    await expectCode(ravi.call("requestLoan", { itemId: "nope" }), "not-found");
    await expectCode(ravi.call("requestLoan", {}), "invalid-argument");
  });
});

describe("recordLoan", () => {
  it("lends to someone who isn't on the app", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId } = await asha.call<{ loanId: string }>("recordLoan", {
      itemId,
      borrowerName: "Uncle Prakash",
      borrowerPhone: "+91 99887 76655",
    });
    const loan = await getDoc<LoanDoc>(COL.loans, loanId);
    expect(loan).toMatchObject({
      status: "active",
      borrowerUid: null,
      borrowerName: "Uncle Prakash",
      borrowerPhone: "+919988776655",
      ownerId: asha.uid,
      requestedAt: null,
    });
    const days = (loan!.dueDate!.toMillis() - loan!.startedAt!.toMillis()) / DAY;
    expect(Math.round(days)).toBe(21);
    expect(await getDoc<ItemDoc>(COL.items, itemId)).toMatchObject({ loanState: "lent", activeLoanId: loanId });
    await expectCode(asha.call("recordLoan", { itemId, borrowerName: "Again" }), "failed-precondition", /already lent/);
    await asha.call("confirmReturn", { loanId });
    expect((await getDoc<ItemDoc>(COL.items, itemId))?.loanState).toBe("available");
  });

  it("matches an app user by phone, declines open requests and notifies", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId: reqId } = await meera.call<RequestRes>("requestLoan", { itemId });
    await clearPushes();
    const { loanId } = await asha.call<{ loanId: string }>("recordLoan", {
      itemId,
      borrowerName: "Ravi",
      borrowerPhone: ravi.phone.replace("+91", "0"),
    });
    expect(await getDoc<LoanDoc>(COL.loans, loanId)).toMatchObject({ borrowerUid: ravi.uid, borrowerPhone: ravi.phone });
    expect(await getDoc<LoanDoc>(COL.loans, reqId)).toMatchObject({ status: "declined", declineReason: "lentToSomeoneElse" });
    expect(await getDoc<WatchDoc>(COL.watches, watchId(meera.uid, "back", itemId))).toMatchObject({
      uid: meera.uid, type: "back", targetId: itemId, workId: WORK.id, title: "The Hobbit",
    });
    expect((await pushesTo(ravi.uid)).map((p) => p.title)).toEqual(["Book lent to you"]);
    expect((await pushesTo(meera.uid)).map((p) => p.body)).toEqual([
      "The Hobbit went to someone else. We'll tell you when it's back.",
    ]);
    // The matched borrower can now mark it returned.
    await ravi.call("markReturned", { loanId });
  });

  it("owner only, valid input", async () => {
    const itemId = await addItem(asha.uid);
    await expectCode(ravi.call("recordLoan", { itemId, borrowerName: "Me" }), "permission-denied");
    await expectCode(asha.call("recordLoan", { itemId, borrowerName: "" }), "invalid-argument");
    await expectCode(asha.call("recordLoan", { itemId, borrowerName: "X", borrowerPhone: "12" }), "invalid-argument");
    await expectCode(asha.call("recordLoan", { itemId, borrowerName: "X", borrowerPhone: asha.phone }), "invalid-argument", /yourself/);
    await expectCode(asha.call("recordLoan", { itemId, borrowerName: "X", dueDate: "2001-01-01" }), "invalid-argument", /past/);
  });
});

describe("pushes only reach people who have the owner saved", () => {
  it("recordLoan to an app user without the owner saved: borrowerUid set, no pushes", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId } = await asha.call<{ loanId: string }>("recordLoan", { itemId, borrowerName: "Kabir", borrowerPhone: kabir.phone });
    expect((await getDoc<LoanDoc>(COL.loans, loanId))?.borrowerUid).toBe(kabir.uid);
    await asha.call("confirmReturn", { loanId }); // no review prompt either
    expect(await pushesTo(kabir.uid)).toEqual([]);
  });

  it("'back' watchers: only linked ones, only for a shared copy; all watches removed", async () => {
    const watchBack = (u: TestUser, itemId: string) =>
      db.collection(COL.watches).doc(watchId(u.uid, "back", itemId)).set({
        uid: u.uid, type: "back", targetId: itemId, workId: WORK.id, title: "The Hobbit", createdAt: Timestamp.now(),
      } satisfies WatchDoc);

    const shared = await addItem(asha.uid);
    await Promise.all([watchBack(meera, shared), watchBack(kabir, shared)]);
    const l1 = await asha.call<{ loanId: string }>("recordLoan", { itemId: shared, borrowerName: "Uncle" });
    await asha.call("confirmReturn", { loanId: l1.loanId });
    expect((await pushesTo(meera.uid)).map((p) => p.title)).toEqual(["Book is back"]);
    expect(await pushesTo(kabir.uid)).toEqual([]);
    expect(await getDoc(COL.watches, watchId(kabir.uid, "back", shared))).toBeUndefined();

    await clearPushes();
    const privShelf = await addShelf(asha.uid, "Private2", false);
    const priv = await addItem(asha.uid, { shelfId: privShelf });
    await watchBack(meera, priv);
    const l2 = await asha.call<{ loanId: string }>("recordLoan", { itemId: priv, borrowerName: "Uncle" });
    await asha.call("confirmReturn", { loanId: l2.loanId });
    expect(await pushesTo(meera.uid)).toEqual([]);
    expect(await getDoc(COL.watches, watchId(meera.uid, "back", priv))).toBeUndefined();
  });
});

// ---- UX v1.1 backend bundle (B2–B4, B6) -------------------------------------------

/** An accepted request from Ravi for a new copy of Asha's. */
async function activeLoanFromRequest(): Promise<{ itemId: string; loanId: string }> {
  const itemId = await addItem(asha.uid);
  const { loanId } = await ravi.call<RequestRes>("requestLoan", { itemId });
  await asha.call("respondToRequest", { loanId, accept: true });
  await clearPushes();
  return { itemId, loanId };
}

const watchBackAdmin = (u: TestUser, itemId: string) =>
  db.collection(COL.watches).doc(watchId(u.uid, "back", itemId)).set({
    uid: u.uid, type: "back", targetId: itemId, workId: WORK.id, title: "The Hobbit", createdAt: Timestamp.now(),
  } satisfies WatchDoc);

describe("B4: decline reasons", () => {
  it("accepting one request declines the other as lentToSomeoneElse, with a back-watch and matching push", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId: raviReq } = await ravi.call<RequestRes>("requestLoan", { itemId });
    const { loanId: meeraReq } = await meera.call<RequestRes>("requestLoan", { itemId });
    await clearPushes();
    await asha.call("respondToRequest", { loanId: raviReq, accept: true });

    expect(await getDoc<LoanDoc>(COL.loans, meeraReq)).toMatchObject({ status: "declined", declineReason: "lentToSomeoneElse" });
    expect((await getDoc<LoanDoc>(COL.loans, raviReq))?.declineReason).toBeUndefined();
    expect(await getDoc<WatchDoc>(COL.watches, watchId(meera.uid, "back", itemId))).toMatchObject({
      uid: meera.uid, type: "back", targetId: itemId, workId: WORK.id, title: "The Hobbit",
    });
    const pushes = await pushesTo(meera.uid);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({
      title: "Request declined",
      body: "The Hobbit went to someone else. We'll tell you when it's back.",
      data: { type: "requestDeclined", loanId: meeraReq, reason: "lentToSomeoneElse" },
    });
  });

  it("stores the owner's reason and uses its text", async () => {
    const cases = [
      ["readingIt", "Asha Rao is reading The Hobbit right now."],
      ["notLending", "Asha Rao isn't lending The Hobbit at the moment."],
      [null, "Asha Rao can't lend The Hobbit right now."],
    ] as const;
    for (const [reason, body] of cases) {
      const itemId = await addItem(asha.uid);
      const { loanId } = await ravi.call<RequestRes>("requestLoan", { itemId });
      await clearPushes();
      await asha.call("respondToRequest", { loanId, accept: false, reason });
      expect(await getDoc<LoanDoc>(COL.loans, loanId)).toMatchObject({ status: "declined", declineReason: reason });
      expect((await pushesTo(ravi.uid)).map((p) => p.body)).toEqual([body]);
      expect(await getDoc(COL.watches, watchId(ravi.uid, "back", itemId))).toBeUndefined();
    }
  });

  it("declining by hand with lentToSomeoneElse also creates the back-watch; bad reasons are rejected", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId } = await ravi.call<RequestRes>("requestLoan", { itemId });
    await expectCode(asha.call("respondToRequest", { loanId, accept: false, reason: "busy" }), "invalid-argument");
    await asha.call("respondToRequest", { loanId, accept: false, reason: "lentToSomeoneElse" });
    expect((await getDoc<LoanDoc>(COL.loans, loanId))?.declineReason).toBe("lentToSomeoneElse");
    expect(await getDoc(COL.watches, watchId(ravi.uid, "back", itemId))).toBeDefined();
  });
});

describe("B2: confirmReturn reason notCollected", () => {
  it("closes an uncollected loan: copy available, cancelled/notCollected, no review prompt, watchers told 'available again'", async () => {
    const { itemId, loanId } = await activeLoanFromRequest();
    await watchBackAdmin(meera, itemId);

    await expectCode(ravi.call("confirmReturn", { loanId, reason: "notCollected" }), "permission-denied", /Only the owner/);
    await expectCode(asha.call("confirmReturn", { loanId, reason: "lost" }), "invalid-argument");
    await asha.call("confirmReturn", { loanId, reason: "notCollected" });

    expect(await getDoc<LoanDoc>(COL.loans, loanId)).toMatchObject({
      status: "cancelled", closedReason: "notCollected", returnedAt: null,
    });
    expect(await getDoc<ItemDoc>(COL.items, itemId)).toMatchObject({ loanState: "available", activeLoanId: null, dueDate: null });
    expect(await pushesTo(ravi.uid)).toEqual([]);
    const meeraPushes = await pushesTo(meera.uid);
    expect(meeraPushes).toHaveLength(1);
    expect(meeraPushes[0]).toMatchObject({
      title: "Available again",
      body: "The Hobbit is available again.",
      data: { type: "availableAgain", itemId },
    });
    expect(await getDoc(COL.watches, watchId(meera.uid, "back", itemId))).toBeUndefined();
    // Closed: it can't be returned or closed again.
    await expectCode(asha.call("confirmReturn", { loanId }), "failed-precondition");
  });

  it("only for active loans; reason 'returned' is the normal return", async () => {
    const { loanId } = await activeLoanFromRequest();
    await ravi.call("markReturned", { loanId });
    await expectCode(asha.call("confirmReturn", { loanId, reason: "notCollected" }), "failed-precondition", /not collected/);
    await asha.call("confirmReturn", { loanId, reason: "returned" });
    const loan = await getDoc<LoanDoc>(COL.loans, loanId);
    expect(loan?.status).toBe("returned");
    expect(loan?.closedReason).toBeUndefined();
    expect((await pushesTo(ravi.uid)).map((p) => p.title)).toEqual(["How was it?"]);
  });
});

describe("B3: markNotReturned", () => {
  it("returnPending -> active, clears returnMarkedAt, tells the borrower, and reminders resume", async () => {
    const { loanId } = await activeLoanFromRequest();
    await ravi.call("markReturned", { loanId });
    await clearPushes();

    await expectCode(ravi.call("markNotReturned", { loanId }), "permission-denied", /Only the owner/);
    await expect(asha.call("markNotReturned", { loanId })).resolves.toEqual({ ok: true });
    const loan = await getDoc<LoanDoc>(COL.loans, loanId);
    expect(loan?.status).toBe("active");
    expect(loan?.returnMarkedAt).toBeNull();
    expect(loan?.notBackYetAt).toBeInstanceOf(Timestamp);
    const pushes = await pushesTo(ravi.uid);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({
      title: "Not back yet",
      body: "Asha Rao hasn't got The Hobbit back yet.",
      data: { type: "notBackYet", loanId },
    });
    await expectCode(asha.call("markNotReturned", { loanId }), "failed-precondition", /an active loan/);

    // Past due: the next daily run sends the overdue reminders again.
    await db.collection(COL.loans).doc(loanId).update({ dueDate: Timestamp.fromMillis(Date.now() - 2 * 3_600_000) });
    const sent: { uids: string[]; message: PushMessage }[] = [];
    const deps: Deps = {
      db,
      auth: adminAuth,
      now: () => new Date(),
      fetch: vi.fn() as unknown as Deps["fetch"],
      deleteUserFiles: async () => undefined,
      push: async (uids, message) => {
        sent.push({ uids, message });
        return { uids, tokenCount: 0, outcome: "recorded" };
      },
    };
    await runDailyMaintenance(deps);
    const mine = sent.filter((x) => x.message.data?.loanId === loanId);
    expect(mine.map((x) => `${x.message.data?.type}:${x.message.data?.role}:${x.uids.join()}`).sort()).toEqual([
      `overdue:borrower:${ravi.uid}`,
      `overdue:owner:${asha.uid}`,
    ]);
  });

  it("notBackYetAt is cleared when the borrower marks it returned again, and on confirm", async () => {
    const { loanId } = await activeLoanFromRequest();
    await ravi.call("markReturned", { loanId });
    await asha.call("markNotReturned", { loanId });
    expect((await getDoc<LoanDoc>(COL.loans, loanId))?.notBackYetAt).toBeInstanceOf(Timestamp);

    await ravi.call("markReturned", { loanId });
    let loan = await getDoc<LoanDoc>(COL.loans, loanId);
    expect(loan?.status).toBe("returnPending");
    expect(loan?.notBackYetAt).toBeNull();

    await asha.call("markNotReturned", { loanId });
    await asha.call("confirmReturn", { loanId });
    loan = await getDoc<LoanDoc>(COL.loans, loanId);
    expect(loan?.status).toBe("returned");
    expect(loan?.notBackYetAt).toBeNull();
  });

  it("returnEvents keeps every returned / not back yet for the timeline (QA Android #10)", async () => {
    const { loanId } = await activeLoanFromRequest();
    await ravi.call("markReturned", { loanId });
    await asha.call("markNotReturned", { loanId });
    await ravi.call("markReturned", { loanId });
    await asha.call("confirmReturn", { loanId });
    const loan = await getDoc<LoanDoc>(COL.loans, loanId);
    expect(loan?.status).toBe("returned");
    expect(loan?.returnEvents?.map((e) => e.kind)).toEqual(["returnMarked", "notBackYet", "returnMarked"]);
    for (const e of loan?.returnEvents ?? []) expect(e.at).toBeInstanceOf(Timestamp);
    const times = (loan?.returnEvents ?? []).map((e) => e.at.toMillis());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("B6: updateDueDate tells the borrower", () => {
  it("pushes dueChanged to a borrower who has the owner saved, not to one who doesn't", async () => {
    const { loanId } = await activeLoanFromRequest();
    const due = new Date(Date.now() + 28 * DAY);
    await asha.call("updateDueDate", { loanId, dueDate: due.toISOString() });
    const moved = await getDoc<LoanDoc>(COL.loans, loanId);
    expect(moved?.dueChangedAt).toBeInstanceOf(Timestamp);
    // The accept-time due date is kept for the timeline (D4).
    expect(moved?.firstDueDate).toBeInstanceOf(Timestamp);
    expect(moved?.firstDueDate?.toMillis()).not.toBe(moved?.dueDate?.toMillis());
    const pushes = await pushesTo(ravi.uid);
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({
      title: "Due date changed",
      body: `Asha Rao changed the due date for The Hobbit to ${shortDate(due)}.`,
      data: { type: "dueChanged", loanId },
    });

    // Kabir doesn't have Asha saved (DECISIONS #23).
    const itemId = await addItem(asha.uid);
    const { loanId: toKabir } = await asha.call<{ loanId: string }>("recordLoan", {
      itemId, borrowerName: "Kabir", borrowerPhone: kabir.phone,
    });
    await asha.call("updateDueDate", { loanId: toKabir, dueDate: due.toISOString() });
    expect(await pushesTo(kabir.uid)).toEqual([]);
  });
});
