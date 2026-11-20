import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { trackedBulkWriter } from "../../src/lib/bulk.js";
import { SYNC_CONTACTS_QUOTA, takeFromWindow, type Quota } from "../../src/lib/rateLimit.js";

describe("takeFromWindow (rolling quota)", () => {
  const q: Quota = { key: "x", limit: 3, windowMs: 1000 };

  it("allows up to the limit inside the window, then refuses", () => {
    expect(takeFromWindow([], 5000, q)).toEqual([5000]);
    expect(takeFromWindow([4500, 4600], 5000, q)).toEqual([4500, 4600, 5000]);
    expect(takeFromWindow([4500, 4600, 4700], 5000, q)).toBeNull();
  });

  it("forgets calls older than the window", () => {
    expect(takeFromWindow([3000, 3999, 4700], 5000, q)).toEqual([4700, 5000]);
  });

  it("syncContacts: 20 calls per rolling 24 hours", () => {
    expect(SYNC_CONTACTS_QUOTA).toMatchObject({ key: "syncContacts", limit: 20, windowMs: 86_400_000 });
  });
});

describe("trackedBulkWriter", () => {
  /** Fake BulkWriter: ops whose path contains "bad" reject. */
  function fakeDb() {
    const pending: Promise<unknown>[] = [];
    const op = (ref: { path: string }) => {
      const p = ref.path.includes("bad") ? Promise.reject(new Error(`failed ${ref.path}`)) : Promise.resolve({});
      pending.push(p.catch(() => undefined));
      return p;
    };
    const writer = {
      onWriteError: () => undefined,
      set: op,
      update: op,
      delete: op,
      close: async () => {
        await Promise.all(pending);
      },
    };
    return { bulkWriter: () => writer } as unknown as Pick<Firestore, "bulkWriter">;
  }
  const ref = (path: string) => ({ path }) as never;

  it("reports the writes that failed after close()", async () => {
    const w = trackedBulkWriter(fakeDb());
    w.set(ref("a/1"), {});
    w.update(ref("a/bad1"), {});
    w.delete(ref("a/2"));
    w.delete(ref("a/bad2"));
    const failures = await w.close();
    expect(failures.map((f) => f.path)).toEqual(["a/bad1", "a/bad2"]);
    expect(String(failures[0]?.error)).toContain("failed a/bad1");
  });

  it("reports nothing when everything landed", async () => {
    const w = trackedBulkWriter(fakeDb());
    w.set(ref("a/1"), {});
    expect(await w.close()).toEqual([]);
  });
});
