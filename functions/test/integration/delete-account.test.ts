import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  WORK,
  type TestUser,
} from "./helpers.js";
import { COL, linkId, reviewId, watchId, type LoanDoc, type ReviewDoc, type WatchDoc, type WorkDoc } from "../../src/model.js";

let zoya: TestUser; // will delete her account
let asha: TestUser;
let ravi: TestUser;

beforeAll(async () => {
  await clearEmulators();
  await ensureWork();
  [zoya, asha, ravi] = (await Promise.all([
    createUser(nextPhone(), "Zoya Khan"),
    createUser(nextPhone(), "Asha Rao"),
    createUser(nextPhone(), "Ravi Menon"),
  ])) as [TestUser, TestUser, TestUser];
  await zoya.call("syncContacts", { phones: [asha.phone] });
  await asha.call("syncContacts", { phones: [zoya.phone] });
  await ravi.call("syncContacts", { phones: [zoya.phone, asha.phone] });
});
afterAll(async () => {
  await cleanupClients();
});

describe("deleteAccount", () => {
  it("removes all of the user's data and anonymises loans they borrowed", async () => {
    // Zoya's stuff
    const priv = await addShelf(zoya.uid, "Private", false);
    const lentToApp = await addItem(zoya.uid);
    const lentToUncle = await addItem(zoya.uid, { shelfId: priv });
    const requested = await addItem(zoya.uid);
    const now = Timestamp.now();
    await db.collection(COL.works).doc("custom_zoya1").set({
      category: "book", source: "custom", title: "Zoya's Poems", authors: ["Zoya Khan"], description: null,
      coverUrl: null, firstPublishYear: null, isCustom: true, createdBy: zoya.uid, createdAt: now, updatedAt: now,
    } satisfies WorkDoc);
    await db.collection(COL.reviews).doc(reviewId(WORK.id, zoya.uid)).set({
      workId: WORK.id, authorId: zoya.uid, authorName: "Zoya Khan", rating: 5, text: "Classic", createdAt: now, updatedAt: now,
    } satisfies ReviewDoc);
    await db.collection(COL.watches).doc(watchId(zoya.uid, "wishlist", WORK.id)).set({
      uid: zoya.uid, type: "wishlist", targetId: WORK.id, workId: WORK.id, title: "The Hobbit", createdAt: now,
    } satisfies WatchDoc);
    // Someone else watching Zoya's copy
    await db.collection(COL.watches).doc(watchId(asha.uid, "back", lentToApp)).set({
      uid: asha.uid, type: "back", targetId: lentToApp, workId: WORK.id, title: "The Hobbit", createdAt: now,
    } satisfies WatchDoc);
    // A file in storage
    const bucket = (await import("firebase-admin/storage")).getStorage().bucket();
    await bucket.file(`covers/${zoya.uid}/poems.jpg`).save(Buffer.from([1, 2, 3]), { contentType: "image/jpeg" });

    // Loans: Zoya lends to Ravi (app) and Uncle (non-app); Asha has a request on Zoya's copy;
    // Zoya borrows from Asha and has a pending request with Asha.
    const { loanId: toRavi } = await zoya.call<{ loanId: string }>("recordLoan", {
      itemId: lentToApp, borrowerName: "Ravi", borrowerPhone: ravi.phone,
    });
    const { loanId: toUncle } = await zoya.call<{ loanId: string }>("recordLoan", { itemId: lentToUncle, borrowerName: "Uncle" });
    const { loanId: ashaReq } = await asha.call<{ loanId: string }>("requestLoan", { itemId: requested });
    const ashaItem = await addItem(asha.uid);
    const ashaItem2 = await addItem(asha.uid);
    const { loanId: borrowed } = await zoya.call<{ loanId: string }>("requestLoan", { itemId: ashaItem });
    await asha.call("respondToRequest", { loanId: borrowed, accept: true });
    const { loanId: pendingReq } = await zoya.call<{ loanId: string }>("requestLoan", { itemId: ashaItem2 });

    const res = await zoya.call<{ ok: boolean; deleted: Record<string, number> }>("deleteAccount", {});
    expect(res.ok).toBe(true);

    const count = async (col: string, field: string) =>
      (await db.collection(col).where(field, "==", zoya.uid).get()).size;
    expect(await count(COL.items, "ownerId")).toBe(0);
    expect(await count(COL.shelves, "ownerId")).toBe(0);
    expect(await count(COL.reviews, "authorId")).toBe(0);
    expect(await count(COL.watches, "uid")).toBe(0);
    expect(await count(COL.links, "viewerId")).toBe(0);
    expect(await count(COL.links, "ownerId")).toBe(0);
    expect(await count(COL.works, "createdBy")).toBe(0);
    expect(await count(COL.loans, "borrowerUid")).toBe(0);
    expect(await getDoc(COL.links, linkId(asha.uid, zoya.uid))).toBeUndefined();
    expect(await getDoc(COL.links, linkId(ravi.uid, asha.uid))).toBeDefined();
    expect(await getDoc(COL.profiles, zoya.uid)).toBeUndefined();
    expect(await getDoc(COL.users, zoya.uid)).toBeUndefined();
    expect(await getDoc(COL.phoneIndex, zoya.phone)).toBeUndefined();
    expect(await getDoc(COL.watches, watchId(asha.uid, "back", lentToApp))).toBeUndefined();
    const [files] = await bucket.getFiles({ prefix: `covers/${zoya.uid}/` });
    expect(files).toHaveLength(0);
    await expect(adminAuth.getUser(zoya.uid)).rejects.toMatchObject({ code: "auth/user-not-found" });

    // Loans Zoya owned: closed and stripped of her phone; the non-app one is gone.
    expect(await getDoc<LoanDoc>(COL.loans, toRavi)).toMatchObject({ status: "returned", ownerPhone: "", borrowerUid: ravi.uid });
    expect(await getDoc(COL.loans, toUncle)).toBeUndefined();
    expect(await getDoc<LoanDoc>(COL.loans, ashaReq)).toMatchObject({ status: "cancelled", borrowerUid: asha.uid });
    // Loans Zoya borrowed: keep the name, drop the uid; open requests are cancelled.
    expect(await getDoc<LoanDoc>(COL.loans, borrowed)).toMatchObject({
      status: "active", borrowerUid: null, borrowerName: "Zoya Khan", ownerId: asha.uid,
    });
    expect(await getDoc<LoanDoc>(COL.loans, pendingReq)).toMatchObject({ status: "cancelled", borrowerUid: null });

    // Asha can still close the loan Zoya borrowed.
    await asha.call("confirmReturn", { loanId: borrowed });
  });
});
