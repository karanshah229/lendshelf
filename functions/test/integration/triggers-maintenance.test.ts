import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  addItem,
  addShelf,
  adminAuth,
  cleanupClients,
  clearEmulators,
  createUser,
  db,
  ensureWork,
  getDoc,
  nextPhone,
  pushesTo,
  waitFor,
  WORK,
  type TestUser,
} from "./helpers.js";
import { runDailyMaintenance } from "../../src/handlers/maintenance.js";
import { cancelRequestsForDeletedItem } from "../../src/handlers/triggers.js";
import type { Deps } from "../../src/lib/context.js";
import type { PushMessage } from "../../src/lib/push.js";
import { COL, watchId, type LoanDoc, type WatchDoc } from "../../src/model.js";

let asha: TestUser;
let ravi: TestUser; // has Asha saved, wishlists The Hobbit
let kabir: TestUser; // wishlists The Hobbit but doesn't have Asha saved

const DAY = 86_400_000;
const HOUR = 3_600_000;

beforeAll(async () => {
  await clearEmulators();
  await ensureWork();
  [asha, ravi, kabir] = (await Promise.all([
    createUser(nextPhone(), "Asha Rao"),
    createUser(nextPhone(), "Ravi Menon"),
    createUser(nextPhone(), "Kabir Shah"),
  ])) as [TestUser, TestUser, TestUser];
  await ravi.call("syncContacts", { phones: [asha.phone] });
  for (const u of [ravi, kabir]) {
    await db.collection(COL.watches).doc(watchId(u.uid, "wishlist", WORK.id)).set({
      uid: u.uid, type: "wishlist", targetId: WORK.id, workId: WORK.id, title: "The Hobbit", createdAt: Timestamp.now(),
    } satisfies WatchDoc);
  }
});
afterAll(async () => {
  await cleanupClients();
});

describe("onItemWritten: wishlist push", () => {
  it("notifies linked wishlist watchers when a copy becomes shared", async () => {
    await addItem(asha.uid);
    const pushes = await waitFor(async () => {
      const p = await pushesTo(ravi.uid);
      return p.length ? p : null;
    }, "wishlist push to Ravi");
    expect(pushes[0]).toMatchObject({
      title: "On your wishlist",
      body: "Asha Rao added The Hobbit.",
      data: { type: "wishlistAdded", workId: WORK.id },
    });
    expect(pushes[0]?.uids).not.toContain(kabir.uid);
    expect(await pushesTo(kabir.uid)).toEqual([]);
  });

  it("hidden or private copies don't notify until they become shared", async () => {
    const before = (await pushesTo(ravi.uid)).length;
    const priv = await addShelf(asha.uid, "Private", false);
    const hiddenId = await addItem(asha.uid, { visibility: "hidden" });
    await addItem(asha.uid, { shelfId: priv });
    await new Promise((r) => setTimeout(r, 2_000));
    expect((await pushesTo(ravi.uid)).length).toBe(before);

    await db.collection(COL.items).doc(hiddenId).update({ visibility: "visible", sharedWithContacts: true });
    await waitFor(async () => (await pushesTo(ravi.uid)).length === before + 1, "push after un-hiding");
    // Further edits to an already-shared copy don't notify again.
    await db.collection(COL.items).doc(hiddenId).update({ language: "fr" });
    await new Promise((r) => setTimeout(r, 2_000));
    expect((await pushesTo(ravi.uid)).length).toBe(before + 1);
  });
});

describe("dailyMaintenance (handler invoked directly)", () => {
  it("expires week-old requests and sends due-soon / overdue reminders", async () => {
    const now = new Date();
    const base: Omit<LoanDoc, "status" | "requestedAt" | "dueDate"> = {
      itemId: "i", workId: WORK.id, ownerId: asha.uid, ownerName: "Asha Rao", ownerPhone: asha.phone,
      borrowerUid: ravi.uid, borrowerName: "Ravi Menon", borrowerPhone: ravi.phone, title: "The Hobbit",
      coverUrl: null, message: null, startedAt: null, returnMarkedAt: null, returnedAt: null,
      updatedAt: Timestamp.fromDate(now),
    };
    const at = (ms: number) => Timestamp.fromMillis(now.getTime() + ms);
    const loans: Record<string, LoanDoc> = {
      old: { ...base, status: "requested", requestedAt: at(-8 * DAY), dueDate: null },
      fresh: { ...base, status: "requested", requestedAt: at(-2 * DAY), dueDate: null },
      dueSoon: { ...base, status: "active", requestedAt: null, dueDate: at(36 * HOUR) },
      dueLater: { ...base, status: "active", requestedAt: null, dueDate: at(10 * DAY) },
      overdue: { ...base, status: "active", requestedAt: null, dueDate: at(-2 * HOUR) },
      overdueNonApp: { ...base, borrowerUid: null, borrowerName: "Uncle", status: "active", requestedAt: null, dueDate: at(-7 * DAY - HOUR) },
      returned: { ...base, status: "returned", requestedAt: null, dueDate: at(-2 * HOUR) },
      // B5: the owner left; no reminders to anyone.
      ownerLeft: { ...base, status: "ownerLeft", ownerPhone: "", requestedAt: null, dueDate: at(-2 * HOUR) },
      ownerLeftDueSoon: { ...base, status: "ownerLeft", ownerPhone: "", requestedAt: null, dueDate: at(36 * HOUR) },
    };
    await Promise.all(Object.entries(loans).map(([id, l]) => db.collection(COL.loans).doc(`m_${id}`).set(l)));

    const sent: { uids: string[]; message: PushMessage }[] = [];
    const deps: Deps = {
      db,
      auth: adminAuth,
      now: () => now,
      fetch: vi.fn() as unknown as Deps["fetch"],
      deleteUserFiles: async () => undefined,
      push: async (uids, message) => {
        sent.push({ uids, message });
        return { uids, tokenCount: 0, outcome: "recorded" };
      },
    };
    const result = await runDailyMaintenance(deps);
    expect(result).toEqual({ expired: 1, dueSoon: 1, overdue: 2 });
    expect((await getDoc<LoanDoc>(COL.loans, "m_old"))?.status).toBe("expired");
    expect((await getDoc<LoanDoc>(COL.loans, "m_fresh"))?.status).toBe("requested");

    const byType = (t: string) => sent.filter((s) => s.message.data?.type === t);
    expect(byType("requestExpired").map((s) => s.message.data?.loanId)).toEqual(["m_old"]);
    expect(byType("dueSoon").map((s) => s.message.data?.loanId)).toEqual(["m_dueSoon"]);
    const overdue = byType("overdue");
    // Borrower + owner for the app loan; owner only for the non-app borrower.
    expect(overdue.map((s) => `${s.message.data?.loanId}:${s.message.data?.role}`).sort()).toEqual([
      "m_overdue:borrower",
      "m_overdue:owner",
      "m_overdueNonApp:owner",
    ]);
    expect(overdue.find((s) => s.message.data?.role === "owner")?.uids).toEqual([asha.uid]);
    expect(sent.filter((s) => String(s.message.data?.loanId).startsWith("m_ownerLeft"))).toEqual([]);

    // Running again the same day doesn't expire anything new.
    sent.length = 0;
    expect((await runDailyMaintenance(deps)).expired).toBe(0);
  });
});

describe("onItemWritten: copy deleted", () => {
  it("cancels its open requests and tells the borrowers", async () => {
    const itemId = await addItem(asha.uid);
    const { loanId } = await ravi.call<{ loanId: string }>("requestLoan", { itemId });
    await db.collection(COL.items).doc(itemId).delete();
    const loan = await waitFor(async () => {
      const l = await getDoc<LoanDoc>(COL.loans, loanId);
      return l?.status === "cancelled" ? l : null;
    }, "request cancelled after the copy was deleted");
    expect(loan.updatedAt.toMillis()).toBeGreaterThan(Date.now() - 60_000);
    expect(loan.closedReason).toBe("copyRemoved");
    const push = await waitFor(async () => (await pushesTo(ravi.uid)).find((p) => p.data?.type === "itemRemoved"), "itemRemoved push");
    expect(push).toMatchObject({ title: "Request cancelled", body: "Asha Rao removed The Hobbit.", data: { loanId } });
  });
});

describe("onItemWritten: late delete trigger (QA B5)", () => {
  const deps = (): Deps => ({
    db,
    auth: adminAuth,
    now: () => new Date(),
    fetch: vi.fn() as unknown as Deps["fetch"],
    deleteUserFiles: async () => undefined,
    push: async (uids) => ({ uids, tokenCount: 0, outcome: "recorded" }),
  });
  const request = async (itemId: string) => {
    const now = Timestamp.now();
    const ref = await db.collection(COL.loans).add({
      itemId, workId: WORK.id, ownerId: asha.uid, ownerName: "Asha Rao", ownerPhone: asha.phone,
      borrowerUid: ravi.uid, borrowerName: "Ravi Menon", borrowerPhone: ravi.phone, title: "The Hobbit",
      coverUrl: null, status: "requested", message: null, dueDate: null, requestedAt: now,
      startedAt: null, returnMarkedAt: null, returnedAt: null, updatedAt: now,
    } satisfies LoanDoc);
    return ref.id;
  };

  it("leaves the requests alone when the copy exists again under the same id", async () => {
    // The copy exists (written again after the delete): kept.
    const itemId = await addItem(asha.uid);
    const again = await request(itemId);
    await cancelRequestsForDeletedItem(deps(), itemId);
    expect((await getDoc<LoanDoc>(COL.loans, again))?.status).toBe("requested");

    // The copy is gone: cancelled.
    const gone = await request("gone-item");
    await cancelRequestsForDeletedItem(deps(), "gone-item");
    expect((await getDoc<LoanDoc>(COL.loans, gone))?.status).toBe("cancelled");
  });
});
