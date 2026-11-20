import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;

function hostPort(value: string | undefined, fallback: string): { host: string; port: number } {
  const [host, port] = (value ?? fallback).replace(/^https?:\/\//, "").split(":");
  return { host: host as string, port: Number(port) };
}

const storageAs = (uid: string | null): FirebaseStorage =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage() as unknown as FirebaseStorage;

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-lendshelf",
    storage: {
      rules: readFileSync(resolve(process.cwd(), "../storage.rules"), "utf8"),
      ...hostPort(process.env.FIREBASE_STORAGE_EMULATOR_HOST, "127.0.0.1:19199"),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage() as unknown as FirebaseStorage, "covers/alice/cover.png"), png, { contentType: "image/png" });
  });
});

describe("storage: covers/{uid}/{fileName}", () => {
  it("any signed-in user can read; anonymous can't", async () => {
    await assertSucceeds(getBytes(ref(storageAs("bob"), "covers/alice/cover.png")));
    await assertFails(getBytes(ref(storageAs(null), "covers/alice/cover.png")));
  });

  it("only the owner uploads images up to 5 MB", async () => {
    await assertSucceeds(uploadBytes(ref(storageAs("alice"), "covers/alice/new.png"), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(storageAs("bob"), "covers/alice/evil.png"), png, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(storageAs("alice"), "covers/alice/notes.txt"), png, { contentType: "text/plain" }));
    // Raster images only: SVG can carry script.
    for (const type of ["image/jpeg", "image/webp", "image/heic"]) {
      await assertSucceeds(uploadBytes(ref(storageAs("alice"), `covers/alice/ok.${type.slice(6)}`), png, { contentType: type }));
    }
    await assertFails(uploadBytes(ref(storageAs("alice"), "covers/alice/evil.svg"), png, { contentType: "image/svg+xml" }));
    await assertFails(uploadBytes(ref(storageAs("alice"), "covers/alice/x.gif"), png, { contentType: "image/gif" }));
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    await assertFails(uploadBytes(ref(storageAs("alice"), "covers/alice/big.png"), big, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(storageAs("alice"), "other/alice.png"), png, { contentType: "image/png" }));
  });

  it("only the owner deletes", async () => {
    await assertFails(deleteObject(ref(storageAs("bob"), "covers/alice/cover.png")));
    await assertSucceeds(deleteObject(ref(storageAs("alice"), "covers/alice/cover.png")));
  });
});
