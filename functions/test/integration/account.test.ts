import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { initializeApp, deleteApp } from "firebase/app";
import {
  cleanupClients,
  clearEmulators,
  createUser,
  db,
  expectCode,
  functionsEmulator,
  getDoc,
  nextPhone,
  REGION,
  PROJECT_ID,
} from "./helpers.js";
import { COL, defaultShelfId, type ProfileDoc, type ShelfDoc, type UserDoc } from "../../src/model.js";

beforeAll(async () => {
  await clearEmulators();
});
afterAll(async () => {
  await cleanupClients();
});

describe("onUserCreated + completeProfile", () => {
  it("bootstraps users, phoneIndex and the default public shelf", async () => {
    const phone = nextPhone();
    const u = await createUser(phone);
    const user = await getDoc<UserDoc>(COL.users, u.uid);
    expect(user).toMatchObject({ phone, pushTokens: [] });
    expect(await getDoc(COL.phoneIndex, phone)).toEqual({ uid: u.uid });
    const shelf = await getDoc<ShelfDoc>(COL.shelves, defaultShelfId(u.uid));
    expect(shelf).toMatchObject({ ownerId: u.uid, name: "My books", isPublic: true });
  });

  it("completeProfile creates then updates the profile", async () => {
    const u = await createUser(nextPhone());
    await expect(u.call("completeProfile", { name: "  Asha   Rao " })).resolves.toEqual({ ok: true });
    let p = await getDoc<ProfileDoc>(COL.profiles, u.uid);
    expect(p).toMatchObject({ name: "Asha Rao", pickupNote: null });
    await u.call("completeProfile", { name: "Asha R", pickupNote: "My place, weekends" });
    p = await getDoc<ProfileDoc>(COL.profiles, u.uid);
    expect(p).toMatchObject({ name: "Asha R", pickupNote: "My place, weekends" });
    // Name-only update keeps the pickup note.
    await u.call("completeProfile", { name: "Asha" });
    p = await getDoc<ProfileDoc>(COL.profiles, u.uid);
    expect(p).toMatchObject({ name: "Asha", pickupNote: "My place, weekends" });
  });

  it("completeProfile is a fallback when the trigger's docs are missing", async () => {
    const phone = nextPhone();
    const u = await createUser(phone);
    await db.collection(COL.users).doc(u.uid).delete();
    await db.collection(COL.phoneIndex).doc(phone).delete();
    await db.collection(COL.shelves).doc(defaultShelfId(u.uid)).delete();
    await u.call("completeProfile", { name: "Late" });
    expect(await getDoc(COL.users, u.uid)).toBeDefined();
    expect(await getDoc(COL.phoneIndex, phone)).toEqual({ uid: u.uid });
    expect(await getDoc(COL.shelves, defaultShelfId(u.uid))).toBeDefined();
    // Idempotent: a second call doesn't create another shelf.
    await u.call("completeProfile", { name: "Late again" });
    const shelves = await db.collection(COL.shelves).where("ownerId", "==", u.uid).get();
    expect(shelves.size).toBe(1);
  });

  it("validates input", async () => {
    const u = await createUser(nextPhone());
    await expectCode(u.call("completeProfile", { name: "   " }), "invalid-argument", /Name is required/);
    await expectCode(u.call("completeProfile", { name: "x".repeat(61) }), "invalid-argument");
    await expectCode(u.call("completeProfile", {}), "invalid-argument");
    await expectCode(u.call("completeProfile", { name: "ok", pickupNote: "x".repeat(201) }), "invalid-argument");
  });

  it("callables require sign-in", async () => {
    const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT_ID }, "anon-client");
    const fns = getFunctions(app, REGION);
    const fe = await functionsEmulator();
    connectFunctionsEmulator(fns, fe.host, fe.port);
    await expectCode(httpsCallable(fns, "completeProfile")({ name: "x" }), "unauthenticated");
    await deleteApp(app);
  });
});
