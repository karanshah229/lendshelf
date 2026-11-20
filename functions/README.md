# LendShelf backend (Firebase)

Cloud Functions (TypeScript, Node 22, region `asia-south1`), Firestore and Storage security rules, tests and demo seed data. The contract is `SPEC.md` §3–5 at the repo root.

| Path | What |
|---|---|
| `../firebase.json`, `../.firebaserc` | Emulator ports, functions source, rules files. Default project `demo-lendshelf`. |
| `../firebase.test.json` | Same, with every emulator port shifted (+10000) and no UI: used by the test scripts so they can run while `serve` is up. |
| `../firestore.rules`, `../storage.rules`, `../firestore.indexes.json` | Security rules and indexes |
| `src/index.ts` | Function exports (wiring only) |
| `src/handlers/*` | One module per area: account, contacts, books, shelves, loans, triggers, maintenance |
| `src/lib/*` | Pure helpers: loan state machine, phone/ISBN normalisation, book lookup (injectable `fetch`), push sending (injectable transport) |
| `src/model.ts` | Firestore document types (mirrors SPEC §3) |
| `test/unit`, `test/rules`, `test/integration` | Vitest suites |
| `scripts/seed.ts` | Demo data for running emulators |
| `scripts/firebase.mjs` | Runs the local `firebase-tools` with a Java 21+ runtime (see below) |

## Requirements

- Node 22, npm 10. `npm install` here installs `firebase-tools` locally; no global install is needed.
- **Java 21 or newer** for the emulators (firebase-tools 15 refuses older Java). `scripts/firebase.mjs` uses `JAVA_HOME` / `PATH` if it is new enough, otherwise it looks for a newer JDK (Android Studio's bundled JBR, common JDK folders) or `LENDSHELF_JAVA_HOME`. On Windows it also sets `-Djdk.net.unixdomain.tmpdir=functions/.tmp`, which fixes the Firestore emulator crashing with "Unable to establish loopback connection". It also sets `FUNCTIONS_DISCOVERY_TIMEOUT=60` (seconds; the default 10 s is too short on a busy machine, e.g. tests running next to `serve`).

## Commands

Run from the repo root with `npm --prefix functions run <script>`, or from this folder with `npm run <script>`.

| Script | What it does |
|---|---|
| `build` | `tsc` to `lib/` (strict) |
| `serve` | Build, then start all emulators: Auth 9099, Firestore 8080, Functions 5001, Storage 9199, UI http://127.0.0.1:4000 |
| `seed` | Wipe Firestore + Auth emulator data and load demo data. Needs `serve` running in another terminal. Idempotent. |
| `test:unit` | Pure helper tests. No emulators. |
| `test:rules` | Firestore + Storage rules tests (starts its own emulators via `emulators:exec`) |
| `test:integration` | Build, then call the deployed-in-emulator callables with the Firebase JS SDK |
| `test` | All three |

The `test*` scripts start their own emulators from `../firebase.test.json` (Auth 19099, Firestore 18080, Functions 15001, Storage 19199, hub 14400, logging 14500, Firestore websocket 19150), so they never touch the data of a running `serve`. The integration helpers read the Functions port from the emulator hub.
| `firebase -- <args>` | Any firebase-tools command with the right Java, e.g. `npm run firebase -- emulators:start --only firestore` |

Stop `serve` with Ctrl+C. `serve` needs ports 4000, 4400, 4500, 5001, 8080, 9099, 9150, 9199 free; `test:*` need 14400, 14500, 15001, 18080, 19099, 19150, 19199, 19299, 19499.

The emulators bind to `127.0.0.1`. The Android emulator reaches them at `10.0.2.2`. For a physical phone on your Wi-Fi, change the `host` values in `../firebase.json` to `0.0.0.0` and point the app at your computer's LAN IP.

### Demo users (after `seed`)

| Name | Phone | uid |
|---|---|---|
| Asha Rao | +919000000001 | demo-asha |
| Ravi Menon | +919000000002 | demo-ravi |
| Meera Iyer | +919000000003 | demo-meera |
| Kabir Shah | +919000000004 | demo-kabir |
| Zoya Khan | +919000000005 | demo-zoya |

Everyone has everyone saved except that **Asha does not have Zoya** (Zoya has Asha: a one-way link). The seed includes 28 real Open Library works (plus their ISBNs in `isbnIndex`) and 1 custom book, 69 copies (some `visible` or `hidden`, one private shelf each for Asha and Kabir), and loans in every status: requested, active, due in 2 days, overdue, returnPending, returned, lent to a non-app person, declined, cancelled, expired. It also has 14 reviews and 4 watches.

Sign-in codes: the Auth emulator never sends SMS; read the code from `GET http://127.0.0.1:9099/emulator/v1/projects/demo-lendshelf/verificationCodes`.

## Functions

All callables require a signed-in user. Errors are `HttpsError`s (`invalid-argument`, `not-found`, `permission-denied`, `failed-precondition`, `already-exists`, `resource-exhausted`, `unavailable`, `unauthenticated`, `internal`) with a user-readable message and no internal details.

**App Check** is opt-in: set `ENFORCE_APP_CHECK=true` (e.g. in `functions/.env`) to make every callable reject requests without a valid App Check token. It is off by default so the emulators and current builds work. **Set up App Check in the app and turn this on before production.** Dates in requests are ISO 8601 strings; dates in responses don't appear (callers read Firestore).

| Name | Type | Request → Response | Notes |
|---|---|---|---|
| `onUserCreated` | Auth trigger (v1) | — | Creates `users/{uid}`, `phoneIndex/{phone}`, default shelf `shelves/default_{uid}` ("My books", public). Idempotent. |
| `completeProfile` | callable | `{ name, pickupNote?: string \| null }` → `{ ok: true }` | Name trimmed, 1–60. `pickupNote` ≤ 200; omit to keep the current one, `null`/`""` to clear. Also re-creates `users`/`phoneIndex`/default shelf if missing. |
| `syncContacts` | callable | `{ phones: string[] }` (≤ 5000) → `{ links: { ownerId, ownerPhone, name: string \| null }[] }` | Numbers should be E.164; 10-digit Indian numbers, `0`-prefixed and `00` prefixes are also normalised. Replaces the caller's links (adds new, deletes missing). Sorted by name. At most 20 calls per user per rolling 24 h (`resource-exhausted`), counted in the backend-only `rateLimits/{uid}`. |
| `resolveBook` | callable | `{ isbn }` \| `{ olWorkKey, isbn? }` \| `{ gbVolumeId, isbn? }` → `{ workId, work, edition }` | ISBN-10 or -13 (hyphens OK). `work` = Work fields without timestamps. `edition` = `{ isbn: string \| null (ISBN-13), coverUrl, language (e.g. "en"), publisher, publishYear }`. `not-found` means "offer a custom book". With `olWorkKey`/`gbVolumeId`, an `isbn` is only used (returned and cached in `isbnIndex`) if it belongs to that work (the Open Library edition's work matches, or the Google Books volume lists it); otherwise `edition.isbn` is `null`. Catalogue requests time out after 8 s; an Open Library failure or timeout falls back to Google Books. |
| `setShelfVisibility` | callable | `{ shelfId, isPublic }` → `{ updated }` | `updated` = number of items whose `sharedWithContacts` changed. |
| `deleteShelf` | callable | `{ shelfId, moveToShelfId }` → `{ moved }` | Both shelves must be the caller's and different. |
| `requestLoan` | callable | `{ itemId, message?: string \| null }` → `{ loanId, ownerPhone }` | `message` ≤ 500. Use `ownerPhone` for the WhatsApp deep link. |
| `respondToRequest` | callable | `{ loanId, accept, dueDate?: ISO \| null }` → `{ ok: true }` | Default due date +21 days. Accepting declines other open requests for the copy. A request older than 7 days becomes `expired` (error `failed-precondition`). |
| `cancelRequest` | callable | `{ loanId }` → `{ ok: true }` | Borrower, `requested` only. |
| `recordLoan` | callable | `{ itemId, borrowerName, borrowerPhone?: string \| null, dueDate?: ISO \| null }` → `{ loanId }` | Owner lends directly. `borrowerPhone` is matched to an app user via `phoneIndex` (sets `borrowerUid`). Declines open requests for the copy. The matched borrower gets pushes about this loan (lent to you, due soon, overdue, review prompt) only if they have the owner saved. |
| `markReturned` | callable | `{ loanId }` → `{ ok: true }` | Borrower: `active` → `returnPending`. |
| `confirmReturn` | callable | `{ loanId }` → `{ ok: true }` | Owner: `active`/`returnPending` → `returned`. Notifies `back` watchers who have the owner saved (only if the copy is shared), then deletes all `back` watches on the copy; asks the borrower for a review. |
| `updateDueDate` | callable | `{ loanId, dueDate: ISO }` → `{ ok: true }` | Owner, `active` loans. |
| `registerPushToken` | callable | `{ token }` (Expo push token) → `{ ok: true }` | Adds the token to the caller's `users.pushTokens` (moved to the end if already there) and removes it from any other user (one account per device). Keeps the 20 newest; the oldest is dropped. `failed-precondition` if the `users` doc doesn't exist yet. |
| `unregisterPushToken` | callable | `{ token }` → `{ ok: true }` | Removes the token from the caller's `pushTokens` (call on sign-out). |
| `deleteAccount` | callable | `{}` → `{ ok: true, deleted: Record<string, number> }` | See "Account deletion" below. The client should sign out afterwards. |
| `onItemWritten` | Firestore trigger `items/{itemId}` | — | When a copy becomes `sharedWithContacts`, pushes "<owner> added <title>" to wishlist watchers of the Work who have the owner saved. When a copy is deleted, its `requested` loans become `cancelled` and the borrowers get "<owner> removed <title>" (`data.type` `itemRemoved`). |
| `dailyMaintenance` | schedule `0 9 * * *` Asia/Kolkata | — | Expires `requested` loans ≥ 7 days old (only if unchanged since read: `lastUpdateTime` precondition); "due soon" (24–48 h before; says "tomorrow" or "in 2 days" by India calendar days) and "overdue" (first day, then weekly) reminders. Logic: `runDailyMaintenance(deps)` in `src/handlers/maintenance.ts`. |

Due dates: a date-only string like `"2026-12-12"` is midnight UTC that day. Due dates can't be in the past (today is allowed) or more than a year ahead.

### Push notifications

`sendPush(uids, { title, body, data })` reads `users/{uid}.pushTokens` (Expo tokens) and POSTs to `https://exp.host/--/api/v2/push/send` in batches of 100. Every push has `data.type` (`loanRequested`, `requestAccepted`, `requestDeclined`, `lentToYou`, `markedReturned`, `reviewPrompt`, `itemBack`, `wishlistAdded`, `itemRemoved`, `requestExpired`, `dueSoon`, `overdue`) plus `loanId` / `itemId` / `workId` for routing taps.

Expo push tickets are read: a token whose ticket says `DeviceNotRegistered` is removed from every `users` doc that holds it. (Receipts are not polled.)

In the Functions emulator (`FUNCTIONS_EMULATOR=true`) nothing is sent: each push is logged and written to the `_testPushes` collection (closed to clients by the rules), which the integration tests read.

### Account deletion

Deletes the caller's items, shelves, reviews, watches, custom works, links (as viewer and owner), profile, `users` doc, `rateLimits` doc, `phoneIndex` entry, `covers/{uid}/` files and the Auth user. If any Firestore write fails it stops before deleting the files and the Auth user and returns `internal` ("please try again"); every step is safe to repeat. Other people's `back` watches on their copies are removed. Loans they **owned**: lent to a non-app person → deleted; otherwise closed (`requested` → `cancelled`, `active`/`returnPending` → `returned`) and `ownerPhone` blanked, so the borrower's history stays. Loans they **borrowed**: `borrowerUid` → `null`, name and phone kept so the owner can get the book back; open requests → `cancelled`.

## Security rules: queries the app may run

Firestore only allows a list query if the rules can be proven from the query's own filters. These are tested in `test/rules/firestore.rules.test.ts`:

- `items` where `ownerId == X` **and** `sharedWithContacts == true` (one query per linked owner X). Without the `sharedWithContacts` filter it is denied.
- `items` / `shelves` where `ownerId == me`.
- `shelves` where `ownerId == X` **and** `isPublic == true`.
- `loans` where `ownerId == me`, or where `borrowerUid == me`.
- `links` where `viewerId == me`.
- `profiles` are read **by id** only (`profiles/{uid}`); listing them is denied.
- `watches` where `uid == me`.
- `reviews` where `authorId == me` (or a linked author). Reviews are normally read **by id**: `reviews/{workId}_{uid}` for me and each linked owner. A linked author's missing review reads as "doesn't exist" (not "permission denied"), so the app can fetch them all without errors. `watches/{me}_{type}_{targetId}` behaves the same, so "am I watching?" is a plain `getDoc`.

Write rules: `items.loanState`, `dueDate`, `activeLoanId` are backend-only (must be `available`/`null`/`null` on create and unchanged on update); `sharedWithContacts` must equal `shelf.isPublic && visibility != "hidden"` (checked with `getAfter`, so a shelf and its first copy can be written in one batch); a copy of a custom work (`custom_` id) must use the caller's own custom work, while a catalogue copy (`ol_`/`gb_` id, `isCustom == false`) needs no work read; a lent copy can't be deleted. `createdAt`/`updatedAt` must be `serverTimestamp()` (`createdAt` on create, `updatedAt` on every write) for items, custom works, shelves, reviews and profiles, and a watch's `createdAt` on create. `authors` (items, custom works) is a list of at most 20 strings of at most 300 characters. `coverUrl` is `null` or starts with `https://covers.openlibrary.org/`, `https://books.google.com/`, `https://books.googleusercontent.com/`, `https://firebasestorage.googleapis.com/`, or (Storage emulator) `http://127.0.0.1:<port>/`, `http://localhost:<port>/`, `http://10.0.2.2:<port>/`. Uploaded covers must be JPEG, PNG, WebP or HEIC/HEIF (no SVG). Shelf `isPublic` changes and shelf deletes go through the callables. `users` docs: the client may only change `pushTokens`. `phoneIndex`, `isbnIndex`, `links`, `loans` are not client-writable.

**Batch size for new copies.** Firestore allows 20 document reads (`get`/`getAfter`/`exists`) per batched write. A new copy reads its shelf (counted once per batch) and, only for an *existing* custom work, that work; catalogue copies and custom works created in the same batch add nothing. So one batch can hold at most **19 copies of distinct existing custom works**; chunking adds at 19 copies per batch (each with its new custom work, if any) is always safe. Pinned by the "batch sizes" rules tests.

Uids must not contain `_` (Firebase Auth uids never do): review and watch ids are split on `_` by the rules.
