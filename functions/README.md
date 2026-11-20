# LendShelf backend (Firebase)

Cloud Functions (TypeScript, Node 22, region `asia-south1`), Firestore and Storage security rules, tests and demo seed data. The contract is `SPEC.md` §3–5 at the repo root.

| Path | What |
|---|---|
| `../firebase.json`, `../.firebaserc` | Emulator ports, functions source, rules files. Default project `demo-lendshelf`. |
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
- **Java 21 or newer** for the emulators (firebase-tools 15 refuses older Java). `scripts/firebase.mjs` uses `JAVA_HOME` / `PATH` if it is new enough, otherwise it looks for a newer JDK (Android Studio's bundled JBR, common JDK folders) or `LENDSHELF_JAVA_HOME`. On Windows it also sets `-Djdk.net.unixdomain.tmpdir=functions/.tmp`, which fixes the Firestore emulator crashing with "Unable to establish loopback connection".

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
| `firebase -- <args>` | Any firebase-tools command with the right Java, e.g. `npm run firebase -- emulators:start --only firestore` |

Stop `serve` with Ctrl+C. `serve`/`test:*` need ports 4000, 4400, 4500, 5001, 8080, 9099, 9150, 9199 free.

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

All callables require a signed-in user. Errors are `HttpsError`s (`invalid-argument`, `not-found`, `permission-denied`, `failed-precondition`, `already-exists`, `unavailable`, `unauthenticated`) with a user-readable message. Dates in requests are ISO 8601 strings; dates in responses don't appear (callers read Firestore).

| Name | Type | Request → Response | Notes |
|---|---|---|---|
| `onUserCreated` | Auth trigger (v1) | — | Creates `users/{uid}`, `phoneIndex/{phone}`, default shelf `shelves/default_{uid}` ("My books", public). Idempotent. |
| `completeProfile` | callable | `{ name, pickupNote?: string \| null }` → `{ ok: true }` | Name trimmed, 1–60. `pickupNote` ≤ 200; omit to keep the current one, `null`/`""` to clear. Also re-creates `users`/`phoneIndex`/default shelf if missing. |
| `syncContacts` | callable | `{ phones: string[] }` (≤ 5000) → `{ links: { ownerId, ownerPhone, name: string \| null }[] }` | Numbers should be E.164; 10-digit Indian numbers, `0`-prefixed and `00` prefixes are also normalised. Replaces the caller's links (adds new, deletes missing). Sorted by name. |
| `resolveBook` | callable | `{ isbn }` \| `{ olWorkKey, isbn? }` \| `{ gbVolumeId, isbn? }` → `{ workId, work, edition }` | ISBN-10 or -13 (hyphens OK). `work` = Work fields without timestamps. `edition` = `{ isbn: string \| null (ISBN-13), coverUrl, language (e.g. "en"), publisher, publishYear }`. `not-found` means "offer a custom book". |
| `setShelfVisibility` | callable | `{ shelfId, isPublic }` → `{ updated }` | `updated` = number of items whose `sharedWithContacts` changed. |
| `deleteShelf` | callable | `{ shelfId, moveToShelfId }` → `{ moved }` | Both shelves must be the caller's and different. |
| `requestLoan` | callable | `{ itemId, message?: string \| null }` → `{ loanId, ownerPhone }` | `message` ≤ 500. Use `ownerPhone` for the WhatsApp deep link. |
| `respondToRequest` | callable | `{ loanId, accept, dueDate?: ISO \| null }` → `{ ok: true }` | Default due date +21 days. Accepting declines other open requests for the copy. A request older than 7 days becomes `expired` (error `failed-precondition`). |
| `cancelRequest` | callable | `{ loanId }` → `{ ok: true }` | Borrower, `requested` only. |
| `recordLoan` | callable | `{ itemId, borrowerName, borrowerPhone?: string \| null, dueDate?: ISO \| null }` → `{ loanId }` | Owner lends directly. `borrowerPhone` is matched to an app user via `phoneIndex`. Declines open requests for the copy. |
| `markReturned` | callable | `{ loanId }` → `{ ok: true }` | Borrower: `active` → `returnPending`. |
| `confirmReturn` | callable | `{ loanId }` → `{ ok: true }` | Owner: `active`/`returnPending` → `returned`. Notifies and deletes `back` watches; asks the borrower for a review. |
| `updateDueDate` | callable | `{ loanId, dueDate: ISO }` → `{ ok: true }` | Owner, `active` loans. |
| `deleteAccount` | callable | `{}` → `{ ok: true, deleted: Record<string, number> }` | See "Account deletion" below. The client should sign out afterwards. |
| `onItemWritten` | Firestore trigger `items/{itemId}` | — | When a copy becomes `sharedWithContacts`, pushes "<owner> added <title>" to wishlist watchers of the Work who have the owner saved. |
| `dailyMaintenance` | schedule `0 9 * * *` Asia/Kolkata | — | Expires `requested` loans ≥ 7 days old; "due in 2 days" (24–48 h before) and "overdue" (first day, then weekly) reminders. Logic: `runDailyMaintenance(deps)` in `src/handlers/maintenance.ts`. |

Due dates: a date-only string like `"2026-12-12"` is midnight UTC that day. Due dates can't be in the past (today is allowed) or more than a year ahead.

### Push notifications

`sendPush(uids, { title, body, data })` reads `users/{uid}.pushTokens` (Expo tokens) and POSTs to `https://exp.host/--/api/v2/push/send` in batches of 100. Every push has `data.type` (`loanRequested`, `requestAccepted`, `requestDeclined`, `lentToYou`, `markedReturned`, `reviewPrompt`, `itemBack`, `wishlistAdded`, `requestExpired`, `dueSoon`, `overdue`) plus `loanId` / `itemId` / `workId` for routing taps.

In the Functions emulator (`FUNCTIONS_EMULATOR=true`) nothing is sent: each push is logged and written to the `_testPushes` collection (closed to clients by the rules), which the integration tests read.

### Account deletion

Deletes the caller's items, shelves, reviews, watches, custom works, links (as viewer and owner), profile, `users` doc, `phoneIndex` entry, `covers/{uid}/` files and the Auth user. Other people's `back` watches on their copies are removed. Loans they **owned**: lent to a non-app person → deleted; otherwise closed (`requested` → `cancelled`, `active`/`returnPending` → `returned`) and `ownerPhone` blanked, so the borrower's history stays. Loans they **borrowed**: `borrowerUid` → `null`, name and phone kept so the owner can get the book back; open requests → `cancelled`.

## Security rules: queries the app may run

Firestore only allows a list query if the rules can be proven from the query's own filters. These are tested in `test/rules/firestore.rules.test.ts`:

- `items` where `ownerId == X` **and** `sharedWithContacts == true` (one query per linked owner X). Without the `sharedWithContacts` filter it is denied.
- `items` / `shelves` where `ownerId == me`.
- `shelves` where `ownerId == X` **and** `isPublic == true`.
- `loans` where `ownerId == me`, or where `borrowerUid == me`.
- `links` where `viewerId == me`.
- `watches` where `uid == me`.
- `reviews` where `authorId == me` (or a linked author). Reviews are normally read **by id**: `reviews/{workId}_{uid}` for me and each linked owner. A linked author's missing review reads as "doesn't exist" (not "permission denied"), so the app can fetch them all without errors. `watches/{me}_{type}_{targetId}` behaves the same, so "am I watching?" is a plain `getDoc`.

Write rules: `items.loanState`, `dueDate`, `activeLoanId` are backend-only (must be `available`/`null`/`null` on create and unchanged on update); `sharedWithContacts` must equal `shelf.isPublic && visibility != "hidden"` (checked with `getAfter`, so a shelf and its first copy can be written in one batch); a copy of a custom work must use the caller's own custom work; a lent copy can't be deleted. Shelf `isPublic` changes and shelf deletes go through the callables. `users` docs: the client may only change `pushTokens`. `phoneIndex`, `isbnIndex`, `links`, `loans` are not client-writable.

Uids must not contain `_` (Firebase Auth uids never do): review and watch ids are split on `_` by the rules.
