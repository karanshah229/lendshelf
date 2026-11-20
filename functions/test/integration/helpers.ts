/**
 * Shared helpers for integration tests. They run against the emulators started
 * by `firebase emulators:exec --config ../firebase.test.json` (auth, firestore,
 * functions, storage on shifted ports), which sets the *_EMULATOR_HOST env vars.
 * The fallbacks are the test ports, never the dev ports, so a stray run can't
 * wipe the dev emulators' data.
 */
process.env.GCLOUD_PROJECT ??= "demo-lendshelf";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:18080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:19099";
process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= "127.0.0.1:19199";
process.env.FIREBASE_EMULATOR_HUB ??= "127.0.0.1:14400";

import { deleteApp as deleteAdminApp, getApps as getAdminApps, initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { expect } from "vitest";
import { computeSharedWithContacts } from "../../src/lib/sharing.js";
import { COL, defaultShelfId, type ItemDoc, type ShelfDoc, type TestPushDoc, type Visibility, type WorkDoc } from "../../src/model.js";

export const PROJECT_ID = "demo-lendshelf";
export const REGION = "asia-south1";
const FIRESTORE = `http://${process.env.FIRESTORE_EMULATOR_HOST}`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;

const adminApp = getAdminApps()[0] ?? initAdmin({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` });
export const db: Firestore = getAdminFirestore(adminApp);
export const adminAuth = getAdminAuth(adminApp);

let functionsHost: Promise<{ host: string; port: number }> | null = null;

/** Host/port of the Functions emulator, from the Emulator Hub (no env var exists for it). */
export function functionsEmulator(): Promise<{ host: string; port: number }> {
  functionsHost ??= (async () => {
    const res = await fetch(`http://${process.env.FIREBASE_EMULATOR_HUB}/emulators`);
    if (!res.ok) throw new Error(`Emulator hub returned ${res.status}`);
    const info = (await res.json()) as { functions?: { host: string; port: number } };
    if (!info.functions) throw new Error("The Functions emulator isn't running");
    return { host: info.functions.host, port: info.functions.port };
  })();
  return functionsHost;
}

export async function clearEmulators(): Promise<void> {
  const r1 = await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  const r2 = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  if (!r1.ok || !r2.ok) throw new Error(`Clearing emulators failed: ${r1.status} / ${r2.status}`);
}

export async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, what: string, timeoutMs = 60_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

export interface TestUser {
  uid: string;
  phone: string;
  name: string;
  app: FirebaseApp;
  call<T = unknown>(name: string, data?: unknown): Promise<T>;
}

const clientApps: FirebaseApp[] = [];
let appCounter = 0;

/** Create a phone user in the Auth emulator, wait for onUserCreated, sign a client in. */
export async function createUser(phone: string, name?: string): Promise<TestUser> {
  const rec = await adminAuth.createUser({ phoneNumber: phone });
  const uid = rec.uid;
  await waitFor(async () => (await db.collection(COL.users).doc(uid).get()).exists, `users/${uid} from onUserCreated`, 90_000);

  const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` }, `user-${++appCounter}`);
  clientApps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH, { disableWarnings: true });
  await signInWithCustomToken(auth, await adminAuth.createCustomToken(uid));
  const fns = getFunctions(app, REGION);
  const fe = await functionsEmulator();
  connectFunctionsEmulator(fns, fe.host, fe.port);
  const user: TestUser = {
    uid,
    phone,
    name: name ?? phone,
    app,
    async call<T>(fname: string, data: unknown = {}) {
      const res = await httpsCallable(fns, fname, { timeout: 90_000 })(data);
      return res.data as T;
    },
  };
  if (name) await user.call("completeProfile", { name });
  return user;
}

export async function cleanupClients(): Promise<void> {
  await Promise.all(clientApps.splice(0).map((a) => deleteApp(a)));
}

export async function cleanupAdmin(): Promise<void> {
  await Promise.all(getAdminApps().map((a) => deleteAdminApp(a)));
}

/** Expect a callable to fail with the given HttpsError code. */
export async function expectCode(p: Promise<unknown>, code: string, message?: RegExp): Promise<void> {
  try {
    await p;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    expect(e.code).toBe(`functions/${code}`);
    if (message) expect(e.message).toMatch(message);
    return;
  }
  throw new Error(`Expected functions/${code} but the call succeeded`);
}

export const WORK = {
  id: "ol_OL27482W",
  doc: {
    category: "book",
    source: "openlibrary",
    title: "The Hobbit",
    authors: ["J.R.R. Tolkien"],
    description: null,
    coverUrl: "https://covers.openlibrary.org/b/id/14627509-L.jpg",
    firstPublishYear: 1937,
    isCustom: false,
    createdBy: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  } satisfies WorkDoc,
};

export async function ensureWork(id = WORK.id, doc: WorkDoc = WORK.doc): Promise<void> {
  await db.collection(COL.works).doc(id).set(doc);
}

export async function addShelf(ownerId: string, name: string, isPublic: boolean, id?: string): Promise<string> {
  const ref = id ? db.collection(COL.shelves).doc(id) : db.collection(COL.shelves).doc();
  const shelf: ShelfDoc = { ownerId, name, isPublic, sortOrder: 1, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
  await ref.set(shelf);
  return ref.id;
}

/** Add a copy (as the client would, but via admin), deriving sharedWithContacts. */
export async function addItem(
  ownerId: string,
  opts: { shelfId?: string; visibility?: Visibility; workId?: string; title?: string } = {},
): Promise<string> {
  const shelfId = opts.shelfId ?? defaultShelfId(ownerId);
  const shelf = (await db.collection(COL.shelves).doc(shelfId).get()).data() as ShelfDoc;
  const visibility = opts.visibility ?? "lendable";
  const item: ItemDoc = {
    ownerId,
    workId: opts.workId ?? WORK.id,
    category: "book",
    shelfId,
    visibility,
    sharedWithContacts: computeSharedWithContacts(shelf.isPublic, visibility),
    title: opts.title ?? WORK.doc.title,
    authors: WORK.doc.authors,
    coverUrl: WORK.doc.coverUrl,
    isCustom: false,
    isbn: "9780547928227",
    format: "paperback",
    language: "en",
    loanState: "available",
    dueDate: null,
    activeLoanId: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  const ref = await db.collection(COL.items).add(item);
  return ref.id;
}

export async function getDoc<T>(col: string, id: string): Promise<T | undefined> {
  return (await db.collection(col).doc(id).get()).data() as T | undefined;
}

/** Pushes recorded by the functions emulator (the `_testPushes` test hook). */
export async function pushesTo(uid: string): Promise<TestPushDoc[]> {
  const snap = await db.collection(COL.testPushes).where("uids", "array-contains", uid).get();
  return snap.docs.map((d) => d.data() as TestPushDoc);
}

export async function clearPushes(): Promise<void> {
  const snap = await db.collection(COL.testPushes).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

let phoneSeq = 0;
/** A unique Indian mobile number for this test run. */
export function nextPhone(): string {
  phoneSeq++;
  return `+9198${String(Date.now() % 1_000_000).padStart(6, "0")}${String(phoneSeq).padStart(2, "0")}`;
}
