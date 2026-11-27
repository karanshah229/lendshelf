/**
 * Runtime dependencies for handlers. Production code uses `defaultDeps()`;
 * tests build their own with fakes (push sender, clock, fetch).
 */
import { getApps, initializeApp, type App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import { FieldValue, getFirestore, initializeFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import type { FetchLike } from "./books.js";
import { createPushSender, EXPO_ACCESS_TOKEN_SECRET, expoTransport, type PushSender } from "./push.js";
import { COL, type UserDoc } from "../model.js";

export interface Deps {
  db: Firestore;
  auth: Auth;
  now: () => Date;
  push: PushSender;
  fetch: FetchLike;
  /** Delete everything under `covers/{uid}/` in Cloud Storage. */
  deleteUserFiles: (uid: string) => Promise<void>;
}

export interface Caller {
  uid: string;
  /** `phone_number` claim from the ID token, if present. */
  phone: string | null;
}

export function adminApp(): App {
  return getApps()[0] ?? initializeApp();
}

/**
 * Test support: true only inside the throwaway Functions emulator that the
 * backend test scripts start (`--project demo-lendshelf`). FUNCTIONS_EMULATOR
 * is set only by the emulator, and `demo-*` project ids can't exist in Cloud,
 * so this is always false on a real project.
 */
export const isTestEmulator = (): boolean =>
  process.env.FUNCTIONS_EMULATOR === "true" && (process.env.GCLOUD_PROJECT ?? "").startsWith("demo-");

/** Reads Expo push tokens from `users/{uid}.pushTokens`. */
export function firestoreTokenLookup(db: Firestore) {
  return async (uids: string[]): Promise<string[]> => {
    if (uids.length === 0) return [];
    const snaps = await db.getAll(...uids.map((u) => db.collection(COL.users).doc(u)));
    return snaps.flatMap((s) => {
      const tokens = (s.data() as Partial<UserDoc> | undefined)?.pushTokens;
      return Array.isArray(tokens) ? tokens : [];
    });
  };
}

/** Removes push tokens Expo reported as dead from every user that holds them. */
export function firestoreTokenRemover(db: Firestore) {
  return async (tokens: string[]): Promise<void> => {
    for (const token of tokens) {
      const holders = await db.collection(COL.users).where("pushTokens", "array-contains", token).get();
      await Promise.all(holders.docs.map((d) => d.ref.update({ pushTokens: FieldValue.arrayRemove(token) })));
    }
    logger.info("Removed unregistered push tokens", { count: tokens.length });
  };
}

/** Test support: in the test emulator every push is recorded in `_testPushes` for the integration tests. */
export function firestorePushRecorder(db: Firestore) {
  return async (r: { uids: string[]; message: { title: string; body: string; data?: Record<string, string> }; tokenCount: number }) => {
    await db.collection(COL.testPushes).add({
      uids: r.uids,
      title: r.message.title,
      body: r.message.body,
      data: r.message.data ?? {},
      tokenCount: r.tokenCount,
      createdAt: FieldValue.serverTimestamp(),
    });
  };
}

/**
 * Firestore over REST (HTTP/1.1) instead of gRPC, so a cold start skips the
 * gRPC channel and protobuf set-up. The SDK switches to gRPC by itself if a
 * call ever needs streaming (handlers use none). Falls back to the existing
 * instance if something already initialised Firestore on this app.
 */
function restFirestore(app: App): Firestore {
  try {
    return initializeFirestore(app, { preferRest: true });
  } catch {
    return getFirestore(app);
  }
}

let cached: Deps | null = null;

/**
 * Built on first use, once per instance. firebase-admin/auth and /storage are
 * required lazily: most functions never use them, and loading them adds to
 * every cold start.
 */
export function defaultDeps(): Deps {
  if (cached) return cached;
  const app = adminApp();
  const db = restFirestore(app);
  const fetchImpl = globalThis.fetch.bind(globalThis);
  let auth: Auth | undefined;
  cached = {
    db,
    get auth() {
      auth ??= (require("firebase-admin/auth") as typeof import("firebase-admin/auth")).getAuth(app);
      return auth;
    },
    now: () => new Date(),
    fetch: fetchImpl as unknown as FetchLike,
    push: createPushSender({
      getTokens: firestoreTokenLookup(db),
      // Set only when the EXPO_ACCESS_TOKEN secret is bound (USE_EXPO_ACCESS_TOKEN=true).
      transport: expoTransport(fetchImpl, { accessToken: process.env[EXPO_ACCESS_TOKEN_SECRET] || undefined }),
      emulator: isTestEmulator(),
      recorder: firestorePushRecorder(db),
      removeTokens: firestoreTokenRemover(db),
    }),
    deleteUserFiles: async (uid) => {
      try {
        const { getStorage } = require("firebase-admin/storage") as typeof import("firebase-admin/storage");
        await getStorage(app).bucket().deleteFiles({ prefix: `covers/${uid}/` });
      } catch (err) {
        logger.warn("Deleting cover photos failed", { uid, error: String(err) });
      }
    },
  };
  return cached;
}

export const ts = (d: Date): Timestamp => Timestamp.fromDate(d);
