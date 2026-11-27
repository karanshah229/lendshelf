/**
 * LendShelf Cloud Functions (region asia-south1). See SPEC.md §5 and README.md.
 *
 * This file only wires triggers to handlers in ./handlers; the logic lives
 * there and in ./lib so it can be tested without the Functions runtime.
 *
 * Cold starts: every function is deployed from this one codebase, so each
 * instance loads this file. To keep start-up short it
 *  - imports only the light firebase-functions entry points at the top
 *    (the package root and `firebase-functions/v2` pull in every provider);
 *  - defines only the function the instance serves (`FUNCTION_TARGET`, set by
 *    Cloud Functions and the emulator), so a callable never loads the
 *    Firestore-trigger, scheduler or v1 Auth modules;
 *  - requires each handler module (and zod, firebase-admin/firestore, ...)
 *    inside the trigger, on the first call.
 * Discovery (deploy, emulator start-up) runs with no FUNCTION_TARGET, so it
 * still sees every function.
 */
import { setGlobalOptions } from "firebase-functions/v2/options";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import type { Caller, Deps } from "./lib/context.js";
import { REGION, TIME_ZONE, type ItemDoc } from "./model.js";
import { EXPO_ACCESS_TOKEN_SECRET } from "./lib/push.js";

/**
 * Expo access token for pushes ("enhanced push security"), opt-in: set
 * USE_EXPO_ACCESS_TOKEN=true in functions/.env.dev / .env.prod only after
 * creating the secret (`firebase functions:secrets:set EXPO_ACCESS_TOKEN`).
 * The secret is declared only then, because the deploy checks every declared
 * secret and fails if it doesn't exist. The value reaches the code as
 * process.env.EXPO_ACCESS_TOKEN (lib/context.ts). It is bound to every v2
 * function, since most of them can send a push.
 */
const USE_EXPO_ACCESS_TOKEN = process.env.USE_EXPO_ACCESS_TOKEN === "true";

setGlobalOptions({
  region: REGION,
  maxInstances: 10,
  ...(USE_EXPO_ACCESS_TOKEN ? { secrets: [defineSecret(EXPO_ACCESS_TOKEN_SECRET)] } : {}),
});

/**
 * App Check on callables is opt-in: set ENFORCE_APP_CHECK=true (e.g. in
 * functions/.env.dev / .env.prod) once the app sends App Check tokens. Off by
 * default so the backend tests and current builds keep working. Turn it on
 * before production.
 */
const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === "true";

// ---- lazy loading ------------------------------------------------------------
// `require` (not `import()`) keeps loading synchronous and cached; the
// `typeof import(...)` casts are type-only and emit nothing.
const load = {
  context: () => require("./lib/context.js") as typeof import("./lib/context.js"),
  account: () => require("./handlers/account.js") as typeof import("./handlers/account.js"),
  books: () => require("./handlers/books.js") as typeof import("./handlers/books.js"),
  contacts: () => require("./handlers/contacts.js") as typeof import("./handlers/contacts.js"),
  devices: () => require("./handlers/devices.js") as typeof import("./handlers/devices.js"),
  loans: () => require("./handlers/loans.js") as typeof import("./handlers/loans.js"),
  shelves: () => require("./handlers/shelves.js") as typeof import("./handlers/shelves.js"),
  triggers: () => require("./handlers/triggers.js") as typeof import("./handlers/triggers.js"),
  maintenance: () => require("./handlers/maintenance.js") as typeof import("./handlers/maintenance.js"),
};
const deps = (): Deps => load.context().defaultDeps();

/** Every exported function name. A FUNCTION_TARGET not listed here makes this file define everything. */
const FUNCTION_NAMES = [
  "onUserCreated",
  "completeProfile",
  "syncContacts",
  "resolveBook",
  "setShelfVisibility",
  "deleteShelf",
  "requestLoan",
  "respondToRequest",
  "cancelRequest",
  "recordLoan",
  "markReturned",
  "confirmReturn",
  "markNotReturned",
  "updateDueDate",
  "registerPushToken",
  "unregisterPushToken",
  "deleteAccount",
  "onItemWritten",
  "dailyMaintenance",
] as const;
type FunctionName = (typeof FUNCTION_NAMES)[number];

const TARGET = process.env.FUNCTION_TARGET ?? "";
const DEFINE_ALL =
  !TARGET || !!process.env.FUNCTION_DEBUG_MODE || !(FUNCTION_NAMES as readonly string[]).includes(TARGET);

/** Runs `define` only on instances that serve `name` (or when every function is wanted). */
function only<T>(name: FunctionName, define: () => T): T | undefined {
  return DEFINE_ALL || TARGET === name ? define() : undefined;
}

// ---- callables -------------------------------------------------------------
type Handler<O> = (deps: Deps, caller: Caller, data: unknown) => Promise<O>;

function requireCaller(req: CallableRequest): Caller {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in first.");
  const phone = req.auth.token.phone_number;
  return { uid: req.auth.uid, phone: typeof phone === "string" ? phone : null };
}

/** Wrap a lazily loaded handler as an authenticated callable with consistent error handling. */
function callable<O>(name: FunctionName, handler: () => Handler<O>) {
  return only(name, () =>
    onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (req) => {
      const caller = requireCaller(req);
      try {
        return await handler()(deps(), caller, req.data);
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error(`${name} failed`, { uid: caller.uid, error: err instanceof Error ? err.stack : String(err) });
        throw new HttpsError("internal", "Something went wrong. Please try again.");
      }
    }),
  );
}

export const completeProfile = callable("completeProfile", () => load.account().completeProfile);
export const syncContacts = callable("syncContacts", () => load.contacts().syncContacts);
export const resolveBook = callable("resolveBook", () => load.books().resolveBook);
export const setShelfVisibility = callable("setShelfVisibility", () => load.shelves().setShelfVisibility);
export const deleteShelf = callable("deleteShelf", () => load.shelves().deleteShelf);
export const requestLoan = callable("requestLoan", () => load.loans().requestLoan);
export const respondToRequest = callable("respondToRequest", () => load.loans().respondToRequest);
export const cancelRequest = callable("cancelRequest", () => load.loans().cancelRequest);
export const recordLoan = callable("recordLoan", () => load.loans().recordLoan);
export const markReturned = callable("markReturned", () => load.loans().markReturned);
export const confirmReturn = callable("confirmReturn", () => load.loans().confirmReturn);
export const markNotReturned = callable("markNotReturned", () => load.loans().markNotReturned);
export const updateDueDate = callable("updateDueDate", () => load.loans().updateDueDate);
export const registerPushToken = callable("registerPushToken", () => load.devices().registerPushToken);
export const unregisterPushToken = callable("unregisterPushToken", () => load.devices().unregisterPushToken);
export const deleteAccount = callable("deleteAccount", () => (d: Deps, caller: Caller) => load.account().deleteAccount(d, caller));

// ---- auth ------------------------------------------------------------------
// v2 has no non-blocking "user created" trigger, so this one stays on v1.
export const onUserCreated = only("onUserCreated", () => {
  const functionsV1 = require("firebase-functions/v1") as typeof import("firebase-functions/v1");
  return functionsV1
    .region(REGION)
    .auth.user()
    .onCreate(async (user) => {
      await load.account().onUserCreatedHandler(deps(), { uid: user.uid, phoneNumber: user.phoneNumber ?? null });
    });
});

// ---- Firestore trigger -------------------------------------------------------
export const onItemWritten = only("onItemWritten", () => {
  const { onDocumentWritten } = require("firebase-functions/v2/firestore") as typeof import("firebase-functions/v2/firestore");
  return onDocumentWritten({ document: "items/{itemId}", region: REGION }, async (event) => {
    const d = deps();
    const before = event.data?.before.exists ? (event.data.before.data() as ItemDoc) : undefined;
    const after = event.data?.after.exists ? (event.data.after.data() as ItemDoc) : undefined;
    await load.triggers().onItemWrittenHandler(d, event.params.itemId, before, after);
  });
});

// ---- schedule ----------------------------------------------------------------
export const dailyMaintenance = only("dailyMaintenance", () => {
  const { onSchedule } = require("firebase-functions/v2/scheduler") as typeof import("firebase-functions/v2/scheduler");
  return onSchedule({ schedule: "0 9 * * *", timeZone: TIME_ZONE, region: REGION }, async () => {
    await load.maintenance().runDailyMaintenance(deps());
  });
});
