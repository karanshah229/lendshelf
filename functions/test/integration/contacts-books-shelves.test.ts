import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addItem,
  addShelf,
  cleanupClients,
  clearEmulators,
  createUser,
  db,
  ensureWork,
  expectCode,
  getDoc,
  nextPhone,
  WORK,
  type TestUser,
} from "./helpers.js";
import { COL, defaultShelfId, linkId, type ItemDoc, type LinkDoc, type ShelfDoc } from "../../src/model.js";
import { Timestamp } from "firebase-admin/firestore";

let asha: TestUser;
let ravi: TestUser;
let meera: TestUser;

beforeAll(async () => {
  await clearEmulators();
  await ensureWork();
  [asha, ravi, meera] = await Promise.all([
    createUser(nextPhone(), "Asha Rao"),
    createUser(nextPhone(), "Ravi Menon"),
    createUser(nextPhone(), "Meera Iyer"),
  ]) as [TestUser, TestUser, TestUser];
});
afterAll(async () => {
  await cleanupClients();
});

describe("syncContacts", () => {
  type Res = { links: { ownerId: string; ownerPhone: string; name: string | null }[]; skippedRemovals: number };

  it("links matched app users (excluding self), one-way, with names", async () => {
    const raviLocal = ravi.phone.replace("+91", ""); // as typed in an address book
    const res = await asha.call<Res>("syncContacts", {
      phones: [raviLocal, meera.phone, asha.phone, "+919999999999", "not a number"],
    });
    expect(res.links).toEqual([
      { ownerId: meera.uid, ownerPhone: meera.phone, name: "Meera Iyer" },
      { ownerId: ravi.uid, ownerPhone: ravi.phone, name: "Ravi Menon" },
    ]);
    expect(res.skippedRemovals).toBe(0);
    const link = await getDoc<LinkDoc>(COL.links, linkId(asha.uid, ravi.uid));
    expect(link).toMatchObject({ viewerId: asha.uid, ownerId: ravi.uid, ownerPhone: ravi.phone });
    // One-way: Ravi has not saved Asha.
    expect(await getDoc(COL.links, linkId(ravi.uid, asha.uid))).toBeUndefined();
    expect(await getDoc(COL.links, linkId(asha.uid, asha.uid))).toBeUndefined();
  });

  it("removes links for numbers no longer in the address book, keeps createdAt for the rest", async () => {
    const before = await getDoc<LinkDoc>(COL.links, linkId(asha.uid, meera.uid));
    const res = await asha.call<Res>("syncContacts", { phones: [meera.phone] });
    expect(res.links.map((l) => l.ownerId)).toEqual([meera.uid]);
    expect(await getDoc(COL.links, linkId(asha.uid, ravi.uid))).toBeUndefined();
    const after = await getDoc<LinkDoc>(COL.links, linkId(asha.uid, meera.uid));
    expect(after?.createdAt.toMillis()).toBe(before?.createdAt.toMillis());
    // An empty sync would remove all (more than half): the guard keeps the link...
    const guarded = await asha.call<Res>("syncContacts", { phones: [] });
    expect(guarded).toEqual({ links: [{ ownerId: meera.uid, ownerPhone: meera.phone, name: "Meera Iyer" }], skippedRemovals: 1 });
    expect(await getDoc(COL.links, linkId(asha.uid, meera.uid))).toBeDefined();
    // ...unless the caller asks to replace.
    await asha.call("syncContacts", { phones: [], replace: true });
    const left = await db.collection(COL.links).where("viewerId", "==", asha.uid).get();
    expect(left.size).toBe(0);
  });

  it("shrink guard: won't remove more than half of the links without replace (B1)", async () => {
    // 10 app users Meera has saved (phoneIndex + links written directly; no Auth users needed).
    const owners = Array.from({ length: 10 }, (_, i) => ({ uid: `shrink${i}`, phone: `+9197770000${String(i).padStart(2, "0")}` }));
    await Promise.all(owners.map((o) => db.collection(COL.phoneIndex).doc(o.phone).set({ uid: o.uid })));
    await Promise.all(
      owners.map((o) =>
        db.collection(COL.links).doc(linkId(meera.uid, o.uid)).set({
          viewerId: meera.uid, ownerId: o.uid, ownerPhone: o.phone, createdAt: Timestamp.now(),
        } satisfies LinkDoc),
      ),
    );
    const meeraLinks = async () => (await db.collection(COL.links).where("viewerId", "==", meera.uid).get()).size;
    const three = owners.slice(0, 3).map((o) => o.phone);

    const guarded = await meera.call<Res>("syncContacts", { phones: three });
    expect(guarded.skippedRemovals).toBe(7);
    expect(guarded.links).toHaveLength(10);
    expect(await meeraLinks()).toBe(10);

    // Adding a new match still works while removals are held back.
    const withRavi = await meera.call<Res>("syncContacts", { phones: [...three, ravi.phone] });
    expect(withRavi.skippedRemovals).toBe(7);
    expect(await getDoc(COL.links, linkId(meera.uid, ravi.uid))).toBeDefined();
    expect(await meeraLinks()).toBe(11);

    const replaced = await meera.call<Res>("syncContacts", { phones: three, replace: true });
    expect(replaced.skippedRemovals).toBe(0);
    expect(replaced.links.map((l) => l.ownerId).sort()).toEqual(["shrink0", "shrink1", "shrink2"]);
    expect(await meeraLinks()).toBe(3);

    // Removing exactly half (or less) needs no replace.
    const half = await meera.call<Res>("syncContacts", { phones: owners.slice(0, 2).map((o) => o.phone) });
    expect(half.skippedRemovals).toBe(0);
    expect(await meeraLinks()).toBe(2);
    await expectCode(meera.call("syncContacts", { phones: [], replace: "yes" }), "invalid-argument");
  });

  it("validates input", async () => {
    await expectCode(asha.call("syncContacts", { phones: "nope" }), "invalid-argument");
    await expectCode(asha.call("syncContacts", { phones: Array(5001).fill("+919000000001") }), "invalid-argument", /5000/);
  });
});

describe("resolveBook (isbnIndex path, no network)", () => {
  it("returns the indexed work and edition", async () => {
    await db.collection(COL.isbnIndex).doc("9780547928227").set({
      workId: WORK.id,
      edition: { isbn: "9780547928227", coverUrl: null, language: "en", publisher: "Mariner Books", publishYear: 2012 },
    });
    const r = await asha.call<{ workId: string; work: { title: string; createdAt?: unknown }; edition: { publisher: string } }>(
      "resolveBook",
      { isbn: "054792822X" },
    );
    expect(r.workId).toBe(WORK.id);
    expect(r.work.title).toBe("The Hobbit");
    expect(r.work.createdAt).toBeUndefined();
    expect(r.edition.publisher).toBe("Mariner Books");
  });

  it("rejects invalid input", async () => {
    await expectCode(asha.call("resolveBook", { isbn: "12345" }), "invalid-argument");
    await expectCode(asha.call("resolveBook", {}), "invalid-argument");
    await expectCode(asha.call("resolveBook", { olWorkKey: "bad key" }), "invalid-argument");
  });
});

describe("setShelfVisibility / deleteShelf", () => {
  it("recomputes sharedWithContacts for every item on the shelf", async () => {
    const shelf = defaultShelfId(ravi.uid);
    const a = await addItem(ravi.uid, { shelfId: shelf, visibility: "lendable" });
    const b = await addItem(ravi.uid, { shelfId: shelf, visibility: "visible" });
    const c = await addItem(ravi.uid, { shelfId: shelf, visibility: "hidden" });
    const shared = async () =>
      Promise.all([a, b, c].map(async (id) => (await getDoc<ItemDoc>(COL.items, id))?.sharedWithContacts));
    expect(await shared()).toEqual([true, true, false]);

    expect(await ravi.call("setShelfVisibility", { shelfId: shelf, isPublic: false })).toEqual({ updated: 2 });
    expect(await shared()).toEqual([false, false, false]);
    expect((await getDoc<ShelfDoc>(COL.shelves, shelf))?.isPublic).toBe(false);

    expect(await ravi.call("setShelfVisibility", { shelfId: shelf, isPublic: true })).toEqual({ updated: 2 });
    expect(await shared()).toEqual([true, true, false]);
  });

  it("only the owner can change visibility", async () => {
    await expectCode(asha.call("setShelfVisibility", { shelfId: defaultShelfId(ravi.uid), isPublic: false }), "permission-denied");
    await expectCode(asha.call("setShelfVisibility", { shelfId: "missing", isPublic: false }), "not-found");
    await expectCode(asha.call("setShelfVisibility", { shelfId: defaultShelfId(asha.uid) }), "invalid-argument");
  });

  it("deleteShelf moves items, recomputes sharing and deletes the shelf", async () => {
    const priv = await addShelf(meera.uid, "Private", false);
    const pub = defaultShelfId(meera.uid);
    const x = await addItem(meera.uid, { shelfId: priv, visibility: "lendable" });
    const y = await addItem(meera.uid, { shelfId: priv, visibility: "hidden" });
    expect((await getDoc<ItemDoc>(COL.items, x))?.sharedWithContacts).toBe(false);

    expect(await meera.call("deleteShelf", { shelfId: priv, moveToShelfId: pub })).toEqual({ moved: 2 });
    expect(await getDoc(COL.shelves, priv)).toBeUndefined();
    expect(await getDoc<ItemDoc>(COL.items, x)).toMatchObject({ shelfId: pub, sharedWithContacts: true });
    expect(await getDoc<ItemDoc>(COL.items, y)).toMatchObject({ shelfId: pub, sharedWithContacts: false });
  });

  it("can't delete into the same shelf, a missing shelf, or someone else's", async () => {
    const only = defaultShelfId(asha.uid);
    await expectCode(asha.call("deleteShelf", { shelfId: only, moveToShelfId: only }), "invalid-argument", /different collection/);
    await expectCode(asha.call("deleteShelf", { shelfId: only, moveToShelfId: "missing" }), "not-found");
    await expectCode(asha.call("deleteShelf", { shelfId: only, moveToShelfId: defaultShelfId(meera.uid) }), "permission-denied");
    await expectCode(meera.call("deleteShelf", { shelfId: only, moveToShelfId: defaultShelfId(meera.uid) }), "permission-denied");
    // A user always keeps at least one shelf: the only one can't be deleted.
    const mine = await db.collection(COL.shelves).where("ownerId", "==", asha.uid).get();
    expect(mine.size).toBe(1);
  });
});
