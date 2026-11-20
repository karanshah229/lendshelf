import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const PROJECT_ID = "demo-lendshelf";
const ALICE = "alice";
const BOB = "bob"; // has Alice saved (links/bob_alice)
const CAROL = "carol"; // has nobody saved
const ALICE_PHONE = "+919000000101";
const BOB_PHONE = "+919000000102";
const WORK = "ol_OL27482W";
const CUSTOM = "custom_alice1";

let env: RulesTestEnvironment;

function hostPort(envVar: string, fallback: string): { host: string; port: number } {
  const [host, port] = (process.env[envVar] ?? fallback).split(":");
  return { host: host as string, port: Number(port) };
}

const t0 = Timestamp.fromDate(new Date("2026-01-01T00:00:00Z"));

function item(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: ALICE,
    workId: WORK,
    category: "book",
    shelfId: "aPublic",
    visibility: "lendable",
    sharedWithContacts: true,
    title: "The Hobbit",
    authors: ["J.R.R. Tolkien"],
    coverUrl: null,
    isCustom: false,
    isbn: "9780547928227",
    format: "paperback",
    language: "en",
    loanState: "available",
    dueDate: null,
    activeLoanId: null,
    createdAt: t0,
    updatedAt: t0,
    ...overrides,
  };
}

function loan(overrides: Record<string, unknown> = {}) {
  return {
    itemId: "i1",
    workId: WORK,
    ownerId: ALICE,
    ownerName: "Alice",
    ownerPhone: ALICE_PHONE,
    borrowerUid: BOB,
    borrowerName: "Bob",
    borrowerPhone: BOB_PHONE,
    title: "The Hobbit",
    coverUrl: null,
    status: "active",
    message: null,
    dueDate: t0,
    requestedAt: t0,
    startedAt: t0,
    returnMarkedAt: null,
    returnedAt: null,
    updatedAt: t0,
    ...overrides,
  };
}

function review(workId: string, uid: string, overrides: Record<string, unknown> = {}) {
  return {
    workId,
    authorId: uid,
    authorName: uid,
    rating: 4,
    text: "Lovely",
    createdAt: t0,
    updatedAt: t0,
    ...overrides,
  };
}

async function seed(): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path: string, data: Record<string, unknown>) => setDoc(doc(db, path), data);
    await put(`users/${ALICE}`, { phone: ALICE_PHONE, pushTokens: [], createdAt: t0 });
    await put(`users/${BOB}`, { phone: BOB_PHONE, pushTokens: [], createdAt: t0 });
    await put(`profiles/${ALICE}`, { name: "Alice", pickupNote: null, createdAt: t0, updatedAt: t0 });
    await put(`phoneIndex/${ALICE_PHONE}`, { uid: ALICE });
    await put(`isbnIndex/9780547928227`, { workId: WORK });
    await put(`links/${BOB}_${ALICE}`, { viewerId: BOB, ownerId: ALICE, ownerPhone: ALICE_PHONE, createdAt: t0 });
    await put(`works/${WORK}`, {
      category: "book", source: "openlibrary", title: "The Hobbit", authors: ["J.R.R. Tolkien"],
      description: null, coverUrl: null, firstPublishYear: 1937, isCustom: false, createdBy: null,
      createdAt: t0, updatedAt: t0,
    });
    await put(`works/${CUSTOM}`, {
      category: "book", source: "custom", title: "Grandma's Recipes", authors: ["Alice"],
      description: null, coverUrl: null, firstPublishYear: null, isCustom: true, createdBy: ALICE,
      createdAt: t0, updatedAt: t0,
    });
    await put(`works/custom_carol1`, {
      category: "book", source: "custom", title: "Carol's Notes", authors: ["Carol"],
      description: null, coverUrl: null, firstPublishYear: null, isCustom: true, createdBy: CAROL,
      createdAt: t0, updatedAt: t0,
    });
    await put(`shelves/aPublic`, { ownerId: ALICE, name: "My books", isPublic: true, sortOrder: 0, createdAt: t0, updatedAt: t0 });
    await put(`shelves/aPrivate`, { ownerId: ALICE, name: "Private", isPublic: false, sortOrder: 1, createdAt: t0, updatedAt: t0 });
    await put(`shelves/bPublic`, { ownerId: BOB, name: "My books", isPublic: true, sortOrder: 0, createdAt: t0, updatedAt: t0 });
    await put(`items/i1`, item());
    await put(`items/i2`, item({ visibility: "hidden", sharedWithContacts: false }));
    await put(`items/i3`, item({ shelfId: "aPrivate", sharedWithContacts: false }));
    await put(`items/iLent`, item({ loanState: "lent", activeLoanId: "l1", dueDate: t0 }));
    await put(`loans/l1`, loan({ itemId: "iLent" }));
    await put(`loans/l2`, loan({ borrowerUid: null, borrowerName: "Uncle", borrowerPhone: null }));
    await put(`reviews/${WORK}_${ALICE}`, review(WORK, ALICE));
    await put(`reviews/${WORK}_${CAROL}`, review(WORK, CAROL));
    await put(`watches/${BOB}_wishlist_${WORK}`, {
      uid: BOB, type: "wishlist", targetId: WORK, workId: WORK, title: "The Hobbit", createdAt: t0,
    });
  });
}

const as = (uid: string, phone?: string): Firestore =>
  env.authenticatedContext(uid, phone ? { phone_number: phone } : {}).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "../firestore.rules"), "utf8"),
      ...hostPort("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080"),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

// ---------------------------------------------------------------------------
describe("client list queries the app relies on", () => {
  it("items where ownerId == X && sharedWithContacts == true: linked viewer OK, unlinked denied", async () => {
    const q = (db: Firestore) =>
      getDocs(query(collection(db, "items"), where("ownerId", "==", ALICE), where("sharedWithContacts", "==", true)));
    const snap = await assertSucceeds(q(as(BOB)));
    expect(snap.docs.map((d) => d.id).sort()).toEqual(["i1", "iLent"]);
    await assertFails(q(as(CAROL)));
    await assertFails(q(anon()));
  });

  it("items where ownerId == X without the sharedWithContacts filter is denied to others", async () => {
    await assertFails(getDocs(query(collection(as(BOB), "items"), where("ownerId", "==", ALICE))));
  });

  it("items where ownerId == me works for the owner", async () => {
    const snap = await assertSucceeds(getDocs(query(collection(as(ALICE), "items"), where("ownerId", "==", ALICE))));
    expect(snap.size).toBe(4);
  });

  it("shelves where ownerId == X && isPublic == true: linked viewer OK, unlinked denied", async () => {
    const q = (db: Firestore) =>
      getDocs(query(collection(db, "shelves"), where("ownerId", "==", ALICE), where("isPublic", "==", true)));
    const snap = await assertSucceeds(q(as(BOB)));
    expect(snap.docs.map((d) => d.id)).toEqual(["aPublic"]);
    await assertFails(q(as(CAROL)));
    await assertFails(getDocs(query(collection(as(BOB), "shelves"), where("ownerId", "==", ALICE))));
  });

  it("loans where ownerId == me / borrowerUid == me", async () => {
    const byOwner = await assertSucceeds(getDocs(query(collection(as(ALICE), "loans"), where("ownerId", "==", ALICE))));
    expect(byOwner.size).toBe(2);
    const byBorrower = await assertSucceeds(getDocs(query(collection(as(BOB), "loans"), where("borrowerUid", "==", BOB))));
    expect(byBorrower.docs.map((d) => d.id)).toEqual(["l1"]);
    // Somebody else's loans
    await assertFails(getDocs(query(collection(as(CAROL), "loans"), where("ownerId", "==", ALICE))));
    await assertFails(getDocs(query(collection(as(CAROL), "loans"), where("borrowerUid", "==", BOB))));
    await assertFails(getDocs(query(collection(as(BOB), "loans"), where("itemId", "==", "iLent"))));
  });

  it("links where viewerId == me", async () => {
    const snap = await assertSucceeds(getDocs(query(collection(as(BOB), "links"), where("viewerId", "==", BOB))));
    expect(snap.size).toBe(1);
    await assertFails(getDocs(query(collection(as(CAROL), "links"), where("viewerId", "==", BOB))));
    // Owners never learn who saved them.
    await assertFails(getDocs(query(collection(as(ALICE), "links"), where("ownerId", "==", ALICE))));
  });

  it("reviews by id: author and linked viewer OK (even when missing), unlinked denied", async () => {
    const id = `${WORK}_${ALICE}`;
    await assertSucceeds(getDoc(doc(as(ALICE), "reviews", id)));
    const s = await assertSucceeds(getDoc(doc(as(BOB), "reviews", id)));
    expect(s.exists()).toBe(true);
    // A linked author who hasn't reviewed: reads as "doesn't exist", not denied.
    const missing = await assertSucceeds(getDoc(doc(as(BOB), "reviews", `ol_OL1W_${ALICE}`)));
    expect(missing.exists()).toBe(false);
    await assertFails(getDoc(doc(as(CAROL), "reviews", id)));
    // Bob doesn't have Carol saved.
    await assertFails(getDoc(doc(as(BOB), "reviews", `${WORK}_${CAROL}`)));
  });

  it("reviews list where authorId == me", async () => {
    await assertSucceeds(getDocs(query(collection(as(ALICE), "reviews"), where("authorId", "==", ALICE))));
    await assertSucceeds(getDocs(query(collection(as(BOB), "reviews"), where("authorId", "==", ALICE))));
    await assertFails(getDocs(query(collection(as(BOB), "reviews"), where("authorId", "==", CAROL))));
    await assertFails(getDocs(query(collection(as(BOB), "reviews"), where("workId", "==", WORK))));
  });
});

// ---------------------------------------------------------------------------
describe("users", () => {
  it("only the user reads their doc", async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), "users", ALICE)));
    await assertFails(getDoc(doc(as(BOB), "users", ALICE)));
  });

  it("only pushTokens is editable", async () => {
    await assertSucceeds(updateDoc(doc(as(ALICE), "users", ALICE), { pushTokens: ["ExponentPushToken[abc]"] }));
    await assertFails(updateDoc(doc(as(ALICE), "users", ALICE), { phone: "+919999999999" }));
    await assertFails(updateDoc(doc(as(ALICE), "users", ALICE), { pushTokens: [], extra: 1 }));
    await assertFails(updateDoc(doc(as(BOB), "users", ALICE), { pushTokens: [] }));
    await assertFails(deleteDoc(doc(as(ALICE), "users", ALICE)));
  });

  it("create requires the token's phone number", async () => {
    await assertSucceeds(setDoc(doc(as(CAROL, "+919000000103"), "users", CAROL), {
      phone: "+919000000103", pushTokens: [], createdAt: serverTimestamp(),
    }));
    await env.clearFirestore();
    await assertFails(setDoc(doc(as(CAROL, "+919000000103"), "users", CAROL), {
      phone: "+919999999999", pushTokens: [], createdAt: serverTimestamp(),
    }));
    await assertFails(setDoc(doc(as(CAROL), "users", CAROL), {
      phone: "+919000000103", pushTokens: [], createdAt: serverTimestamp(),
    }));
  });
});

describe("profiles", () => {
  it("readable by any signed-in user, not anonymous", async () => {
    await assertSucceeds(getDoc(doc(as(CAROL), "profiles", ALICE)));
    await assertFails(getDoc(doc(anon(), "profiles", ALICE)));
  });

  it("own profile with valid fields only", async () => {
    const p = { name: "Bob", pickupNote: "Weekends", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as(BOB), "profiles", BOB), p));
    await assertFails(setDoc(doc(as(BOB), "profiles", CAROL), p));
    await assertFails(setDoc(doc(as(CAROL), "profiles", CAROL), { ...p, name: "" }));
    await assertFails(setDoc(doc(as(CAROL), "profiles", CAROL), { ...p, name: "x".repeat(61) }));
    await assertFails(setDoc(doc(as(CAROL), "profiles", CAROL), { ...p, pickupNote: "x".repeat(201) }));
    await assertFails(setDoc(doc(as(CAROL), "profiles", CAROL), { ...p, admin: true }));
    await assertSucceeds(updateDoc(doc(as(ALICE), "profiles", ALICE), { name: "Alice R", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ALICE), "profiles", ALICE), { createdAt: serverTimestamp() }));
  });
});

describe("backend-only collections", () => {
  it("phoneIndex, isbnIndex, links, loans and _testPushes are not client-writable", async () => {
    const db = as(ALICE);
    await assertFails(getDoc(doc(db, "phoneIndex", ALICE_PHONE)));
    await assertFails(setDoc(doc(db, "phoneIndex", "+919000000999"), { uid: ALICE }));
    await assertFails(getDoc(doc(db, "isbnIndex", "9780547928227")));
    await assertFails(setDoc(doc(db, "isbnIndex", "9780000000002"), { workId: WORK }));
    await assertFails(setDoc(doc(as(CAROL), "links", `${CAROL}_${ALICE}`), {
      viewerId: CAROL, ownerId: ALICE, ownerPhone: ALICE_PHONE, createdAt: serverTimestamp(),
    }));
    await assertFails(deleteDoc(doc(as(BOB), "links", `${BOB}_${ALICE}`)));
    await assertFails(setDoc(doc(db, "loans", "new"), loan()));
    await assertFails(updateDoc(doc(db, "loans", "l1"), { status: "returned" }));
    await assertFails(updateDoc(doc(as(BOB), "loans", "l1"), { status: "returnPending" }));
    await assertFails(getDoc(doc(db, "_testPushes", "x")));
  });

  it("links and loans are readable by the right people only", async () => {
    await assertSucceeds(getDoc(doc(as(BOB), "links", `${BOB}_${ALICE}`)));
    await assertFails(getDoc(doc(as(ALICE), "links", `${BOB}_${ALICE}`)));
    await assertSucceeds(getDoc(doc(as(ALICE), "loans", "l1")));
    await assertSucceeds(getDoc(doc(as(BOB), "loans", "l1")));
    await assertFails(getDoc(doc(as(CAROL), "loans", "l1")));
  });
});

describe("works", () => {
  it("catalogue works are readable by any signed-in user; nobody can write them", async () => {
    await assertSucceeds(getDoc(doc(as(CAROL), "works", WORK)));
    await assertFails(getDoc(doc(anon(), "works", WORK)));
    await assertFails(updateDoc(doc(as(ALICE), "works", WORK), { title: "Hacked" }));
    await assertFails(setDoc(doc(as(ALICE), "works", "ol_OL1W"), {
      category: "book", source: "openlibrary", title: "X", authors: [], description: null, coverUrl: null,
      firstPublishYear: null, isCustom: false, createdBy: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }));
  });

  it("custom works are readable only by the creator and linked viewers", async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), "works", CUSTOM)));
    await assertSucceeds(getDoc(doc(as(BOB), "works", CUSTOM)));
    await assertFails(getDoc(doc(as(CAROL), "works", CUSTOM)));
    await assertFails(getDoc(doc(as(BOB), "works", "custom_carol1")));
  });

  it("custom works: create/update by creator with custom_ id only", async () => {
    const w = {
      category: "book", source: "custom", title: "Bob's Diary", authors: ["Bob"], description: null,
      coverUrl: null, firstPublishYear: null, isCustom: true, createdBy: BOB,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    await assertSucceeds(setDoc(doc(as(BOB), "works", "custom_bob1"), w));
    await assertFails(setDoc(doc(as(BOB), "works", "ol_OL99W"), w));
    await assertFails(setDoc(doc(as(BOB), "works", "custom_bob2"), { ...w, createdBy: ALICE }));
    await assertFails(setDoc(doc(as(BOB), "works", "custom_bob3"), { ...w, isCustom: false }));
    await assertSucceeds(updateDoc(doc(as(ALICE), "works", CUSTOM), { title: "Grandma's Best Recipes", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(BOB), "works", CUSTOM), { title: "Mine now", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ALICE), "works", CUSTOM), { createdBy: BOB }));
  });
});

describe("shelves", () => {
  it("owner reads all; linked viewer reads public; others nothing", async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), "shelves", "aPrivate")));
    await assertSucceeds(getDoc(doc(as(BOB), "shelves", "aPublic")));
    await assertFails(getDoc(doc(as(BOB), "shelves", "aPrivate")));
    await assertFails(getDoc(doc(as(CAROL), "shelves", "aPublic")));
  });

  it("owner can create and rename, but not flip isPublic or delete", async () => {
    const s = { ownerId: BOB, name: "Comics", isPublic: false, sortOrder: 2, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as(BOB), "shelves", "bComics"), s));
    await assertFails(setDoc(doc(as(BOB), "shelves", "x"), { ...s, ownerId: ALICE }));
    await assertFails(setDoc(doc(as(BOB), "shelves", "y"), { ...s, name: "x".repeat(41) }));
    await assertSucceeds(updateDoc(doc(as(ALICE), "shelves", "aPublic"), { name: "Fiction", sortOrder: 3, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ALICE), "shelves", "aPublic"), { isPublic: false }));
    await assertFails(updateDoc(doc(as(BOB), "shelves", "aPublic"), { name: "Mine" }));
    await assertFails(deleteDoc(doc(as(ALICE), "shelves", "aPrivate")));
  });
});

describe("items", () => {
  const newItem = (o: Record<string, unknown> = {}) => item({ createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o });

  it("readable by owner, and by linked viewers only when shared", async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), "items", "i2")));
    await assertSucceeds(getDoc(doc(as(BOB), "items", "i1")));
    await assertFails(getDoc(doc(as(BOB), "items", "i2")));
    await assertFails(getDoc(doc(as(BOB), "items", "i3")));
    await assertFails(getDoc(doc(as(CAROL), "items", "i1")));
  });

  it("owner can create a valid copy", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "items", "n1"), newItem()));
    await assertSucceeds(setDoc(doc(as(ALICE), "items", "n2"), newItem({ visibility: "hidden", sharedWithContacts: false })));
    await assertSucceeds(setDoc(doc(as(ALICE), "items", "n3"), newItem({ shelfId: "aPrivate", sharedWithContacts: false })));
  });

  it("owner can't set loanState, activeLoanId or dueDate", async () => {
    await assertFails(setDoc(doc(as(ALICE), "items", "n1"), newItem({ loanState: "lent" })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n2"), newItem({ activeLoanId: "l1" })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n3"), newItem({ dueDate: t0 })));
    await assertFails(updateDoc(doc(as(ALICE), "items", "i1"), { loanState: "lent" }));
    await assertFails(updateDoc(doc(as(ALICE), "items", "i1"), { activeLoanId: "x" }));
    await assertFails(updateDoc(doc(as(ALICE), "items", "iLent"), { loanState: "available", activeLoanId: null, dueDate: null }));
  });

  it("sharedWithContacts must equal shelf.isPublic && visibility != hidden", async () => {
    await assertFails(setDoc(doc(as(ALICE), "items", "n1"), newItem({ sharedWithContacts: false })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n2"), newItem({ visibility: "hidden", sharedWithContacts: true })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n3"), newItem({ shelfId: "aPrivate", sharedWithContacts: true })));
    // Updates are checked too.
    await assertFails(updateDoc(doc(as(ALICE), "items", "i1"), { visibility: "hidden" }));
    await assertSucceeds(updateDoc(doc(as(ALICE), "items", "i1"), { visibility: "hidden", sharedWithContacts: false }));
    await assertSucceeds(updateDoc(doc(as(ALICE), "items", "i1"), { visibility: "visible", sharedWithContacts: true }));
    // Moving to a private shelf must clear sharedWithContacts.
    await assertFails(updateDoc(doc(as(ALICE), "items", "i1"), { shelfId: "aPrivate" }));
    await assertSucceeds(updateDoc(doc(as(ALICE), "items", "i1"), { shelfId: "aPrivate", sharedWithContacts: false }));
  });

  it("shelf created in the same batch counts (getAfter)", async () => {
    const db = as(ALICE);
    const batch = writeBatch(db);
    batch.set(doc(db, "shelves", "aNew"), {
      ownerId: ALICE, name: "New", isPublic: false, sortOrder: 5, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, "items", "n1"), newItem({ shelfId: "aNew", sharedWithContacts: false }));
    await assertSucceeds(batch.commit());
  });

  it("can't put a copy on someone else's shelf or a missing shelf", async () => {
    await assertFails(setDoc(doc(as(ALICE), "items", "n1"), newItem({ shelfId: "bPublic" })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n2"), newItem({ shelfId: "nope" })));
  });

  it("can't create copies for someone else or with extra fields", async () => {
    await assertFails(setDoc(doc(as(BOB), "items", "n1"), newItem()));
    await assertFails(setDoc(doc(as(ALICE), "items", "n2"), newItem({ hacked: true })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n3"), newItem({ visibility: "public" })));
  });

  it("custom work copies: only the creator's own custom works", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "items", "n1"), newItem({ workId: CUSTOM, isCustom: true })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n2"), newItem({ workId: CUSTOM, isCustom: false })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n3"), newItem({ workId: "custom_carol1", isCustom: true })));
    await assertFails(setDoc(doc(as(ALICE), "items", "n4"), newItem({ workId: "ol_DOESNOTEXISTW" })));
  });

  it("can't delete a lent copy; can delete an available one", async () => {
    await assertFails(deleteDoc(doc(as(ALICE), "items", "iLent")));
    await assertSucceeds(deleteDoc(doc(as(ALICE), "items", "i1")));
    await assertFails(deleteDoc(doc(as(BOB), "items", "i2")));
  });
});

describe("reviews", () => {
  const r = (workId: string, uid: string, o: Record<string, unknown> = {}) =>
    review(workId, uid, { createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o });

  it("id must be `${workId}_${uid}` and author must be the caller", async () => {
    await assertSucceeds(setDoc(doc(as(BOB), "reviews", `${WORK}_${BOB}`), r(WORK, BOB)));
    await assertFails(setDoc(doc(as(BOB), "reviews", `${WORK}_${CAROL}`), r(WORK, CAROL)));
    await assertFails(setDoc(doc(as(BOB), "reviews", `${WORK}_${CAROL}`), r(WORK, BOB)));
    await assertFails(setDoc(doc(as(BOB), "reviews", `random`), r(WORK, BOB)));
    await assertFails(setDoc(doc(as(BOB), "reviews", `ol_OL1W_${BOB}`), r(WORK, BOB)));
  });

  it("rating 1-5 integer, text <= 2000, work must exist", async () => {
    await assertFails(setDoc(doc(as(BOB), "reviews", `${WORK}_${BOB}`), r(WORK, BOB, { rating: 6 })));
    await assertFails(setDoc(doc(as(BOB), "reviews", `${WORK}_${BOB}`), r(WORK, BOB, { rating: 0 })));
    await assertFails(setDoc(doc(as(BOB), "reviews", `${WORK}_${BOB}`), r(WORK, BOB, { rating: 3.5 })));
    await assertFails(setDoc(doc(as(BOB), "reviews", `${WORK}_${BOB}`), r(WORK, BOB, { text: "x".repeat(2001) })));
    await assertFails(setDoc(doc(as(BOB), "reviews", `ol_OL1W_${BOB}`), r("ol_OL1W", BOB)));
    await assertSucceeds(setDoc(doc(as(BOB), "reviews", `${WORK}_${BOB}`), r(WORK, BOB, { rating: 5, text: null })));
  });

  it("author can edit and delete; others can't", async () => {
    const id = `${WORK}_${ALICE}`;
    await assertSucceeds(updateDoc(doc(as(ALICE), "reviews", id), { rating: 2, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ALICE), "reviews", id), { authorId: BOB }));
    await assertFails(updateDoc(doc(as(BOB), "reviews", id), { rating: 1 }));
    await assertFails(deleteDoc(doc(as(BOB), "reviews", id)));
    await assertSucceeds(deleteDoc(doc(as(ALICE), "reviews", id)));
  });
});

describe("watches", () => {
  const w = (uid: string, type: string, targetId: string, workId = WORK) => ({
    uid, type, targetId, workId, title: "The Hobbit", createdAt: serverTimestamp(),
  });

  it("private to the owner (get, list)", async () => {
    await assertSucceeds(getDoc(doc(as(BOB), "watches", `${BOB}_wishlist_${WORK}`)));
    await assertSucceeds(getDoc(doc(as(BOB), "watches", `${BOB}_back_i1`))); // missing: reads as not-exists
    await assertFails(getDoc(doc(as(ALICE), "watches", `${BOB}_wishlist_${WORK}`)));
    await assertSucceeds(getDocs(query(collection(as(BOB), "watches"), where("uid", "==", BOB))));
    await assertFails(getDocs(query(collection(as(ALICE), "watches"), where("uid", "==", BOB))));
    await assertFails(getDocs(query(collection(as(ALICE), "watches"), where("targetId", "==", WORK))));
  });

  it("id must match fields", async () => {
    await assertSucceeds(setDoc(doc(as(CAROL), "watches", `${CAROL}_back_i1`), w(CAROL, "back", "i1")));
    await assertSucceeds(setDoc(doc(as(CAROL), "watches", `${CAROL}_wishlist_${WORK}`), w(CAROL, "wishlist", WORK)));
    await assertFails(setDoc(doc(as(CAROL), "watches", `${CAROL}_back_i2`), w(CAROL, "back", "i1")));
    await assertFails(setDoc(doc(as(CAROL), "watches", `${BOB}_back_i1`), w(BOB, "back", "i1")));
    await assertFails(setDoc(doc(as(CAROL), "watches", `${CAROL}_other_i1`), w(CAROL, "other", "i1")));
    await assertFails(setDoc(doc(as(CAROL), "watches", `${CAROL}_wishlist_ol_X`), w(CAROL, "wishlist", "ol_X", WORK)));
    await assertFails(deleteDoc(doc(as(ALICE), "watches", `${BOB}_wishlist_${WORK}`)));
    await assertSucceeds(deleteDoc(doc(as(BOB), "watches", `${BOB}_wishlist_${WORK}`)));
  });
});
