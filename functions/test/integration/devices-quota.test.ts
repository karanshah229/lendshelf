import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupClients, clearEmulators, createUser, db, expectCode, getDoc, nextPhone, type TestUser } from "./helpers.js";
import { COL, type UserDoc } from "../../src/model.js";

let asha: TestUser;
let ravi: TestUser;

const token = (s: string) => `ExponentPushToken[${s}]`;
const HOUR = 3_600_000;

beforeAll(async () => {
  await clearEmulators();
  [asha, ravi] = (await Promise.all([createUser(nextPhone(), "Asha Rao"), createUser(nextPhone(), "Ravi Menon")])) as [
    TestUser,
    TestUser,
  ];
});
afterAll(async () => {
  await cleanupClients();
});

const tokensOf = async (u: TestUser) => (await getDoc<UserDoc>(COL.users, u.uid))?.pushTokens;

describe("registerPushToken / unregisterPushToken", () => {
  it("adds the token, and moves a device from one account to another", async () => {
    await expect(asha.call("registerPushToken", { token: token("dev1") })).resolves.toEqual({ ok: true });
    await asha.call("registerPushToken", { token: token("dev1") }); // idempotent
    expect(await tokensOf(asha)).toEqual([token("dev1")]);

    // Same phone, now signed in as Ravi.
    await ravi.call("registerPushToken", { token: token("dev1") });
    expect(await tokensOf(ravi)).toEqual([token("dev1")]);
    expect(await tokensOf(asha)).toEqual([]);
  });

  it("keeps the 20 newest tokens", async () => {
    await db.collection(COL.users).doc(asha.uid).update({
      pushTokens: Array.from({ length: 20 }, (_, i) => token(`old${i}`)),
    });
    await asha.call("registerPushToken", { token: token("newest") });
    const tokens = await tokensOf(asha);
    expect(tokens).toHaveLength(20);
    expect(tokens?.[0]).toBe(token("old1"));
    expect(tokens?.[19]).toBe(token("newest"));
  });

  it("unregisters, and validates the token", async () => {
    await asha.call("unregisterPushToken", { token: token("newest") });
    expect(await tokensOf(asha)).not.toContain(token("newest"));
    await expectCode(asha.call("registerPushToken", { token: "not-a-token" }), "invalid-argument");
    await expectCode(asha.call("registerPushToken", {}), "invalid-argument");
  });
});

describe("syncContacts quota", () => {
  it("allows 20 calls per rolling 24 hours", async () => {
    const recent = Array.from({ length: 20 }, (_, i) => Timestamp.fromMillis(Date.now() - (i + 1) * HOUR));
    await db.collection(COL.rateLimits).doc(ravi.uid).set({ syncContacts: recent });
    await expectCode(ravi.call("syncContacts", { phones: [asha.phone] }), "resource-exhausted");

    const old = Array.from({ length: 20 }, () => Timestamp.fromMillis(Date.now() - 25 * HOUR));
    await db.collection(COL.rateLimits).doc(ravi.uid).set({ syncContacts: old });
    const res = await ravi.call<{ links: unknown[] }>("syncContacts", { phones: [asha.phone] });
    expect(res.links).toHaveLength(1);
    const doc = await getDoc<{ syncContacts: Timestamp[] }>(COL.rateLimits, ravi.uid);
    expect(doc?.syncContacts).toHaveLength(1);
  });

  it("invalid input doesn't use up the quota", async () => {
    await db.collection(COL.rateLimits).doc(asha.uid).delete();
    await expectCode(asha.call("syncContacts", { phones: Array(5001).fill("+919000000001") }), "invalid-argument");
    expect(await getDoc(COL.rateLimits, asha.uid)).toBeUndefined();
  });
});
