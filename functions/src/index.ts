/**
 * LendShelf Cloud Functions (region asia-south1). See SPEC.md §5 and README.md.
 *
 * This file only wires triggers to handlers in ./handlers; the logic lives
 * there and in ./lib so it can be tested without the Functions runtime.
 */
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functionsV1 from "firebase-functions/v1";
import { logger } from "firebase-functions";

import { defaultDeps, type Caller, type Deps } from "./lib/context.js";
import { REGION, TIME_ZONE, type ItemDoc } from "./model.js";
import * as account from "./handlers/account.js";
import * as books from "./handlers/books.js";
import * as contacts from "./handlers/contacts.js";
import * as loans from "./handlers/loans.js";
import * as shelves from "./handlers/shelves.js";
import { onItemWrittenHandler } from "./handlers/triggers.js";
import { runDailyMaintenance } from "./handlers/maintenance.js";

setGlobalOptions({ region: REGION, maxInstances: 10 });

type Handler<O> = (deps: Deps, caller: Caller, data: unknown) => Promise<O>;

function requireCaller(req: CallableRequest): Caller {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in first.");
  const phone = req.auth.token.phone_number;
  return { uid: req.auth.uid, phone: typeof phone === "string" ? phone : null };
}

/** Wrap a handler as an authenticated callable with consistent error handling. */
function callable<O>(name: string, handler: Handler<O>) {
  return onCall({ region: REGION }, async (req) => {
    const caller = requireCaller(req);
    try {
      return await handler(defaultDeps(), caller, req.data);
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error(`${name} failed`, { uid: caller.uid, error: err instanceof Error ? err.stack : String(err) });
      throw new HttpsError("internal", "Something went wrong. Please try again.");
    }
  });
}

// ---- auth ------------------------------------------------------------------
// v2 has no non-blocking "user created" trigger, so this one stays on v1.
export const onUserCreated = functionsV1
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    await account.onUserCreatedHandler(defaultDeps(), { uid: user.uid, phoneNumber: user.phoneNumber ?? null });
  });

// ---- callables -------------------------------------------------------------
export const completeProfile = callable("completeProfile", account.completeProfile);
export const syncContacts = callable("syncContacts", contacts.syncContacts);
export const resolveBook = callable("resolveBook", books.resolveBook);
export const setShelfVisibility = callable("setShelfVisibility", shelves.setShelfVisibility);
export const deleteShelf = callable("deleteShelf", shelves.deleteShelf);
export const requestLoan = callable("requestLoan", loans.requestLoan);
export const respondToRequest = callable("respondToRequest", loans.respondToRequest);
export const cancelRequest = callable("cancelRequest", loans.cancelRequest);
export const recordLoan = callable("recordLoan", loans.recordLoan);
export const markReturned = callable("markReturned", loans.markReturned);
export const confirmReturn = callable("confirmReturn", loans.confirmReturn);
export const updateDueDate = callable("updateDueDate", loans.updateDueDate);
export const deleteAccount = callable("deleteAccount", (deps, caller) => account.deleteAccount(deps, caller));

// ---- Firestore trigger -------------------------------------------------------
export const onItemWritten = onDocumentWritten({ document: "items/{itemId}", region: REGION }, async (event) => {
  const before = event.data?.before.exists ? (event.data.before.data() as ItemDoc) : undefined;
  const after = event.data?.after.exists ? (event.data.after.data() as ItemDoc) : undefined;
  await onItemWrittenHandler(defaultDeps(), event.params.itemId, before, after);
});

// ---- schedule ----------------------------------------------------------------
export const dailyMaintenance = onSchedule(
  { schedule: "0 9 * * *", timeZone: TIME_ZONE, region: REGION },
  async () => {
    await runDailyMaintenance(defaultDeps());
  },
);
