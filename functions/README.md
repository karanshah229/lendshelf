# LendShelf backend (Firebase)

Cloud Functions (TypeScript, Node 22, region `asia-south1`), Firestore and Storage security rules, and their tests. The contract is `SPEC.md` §3–5 at the repo root.

There is no local emulator for running the app: the app talks to the real `lendshelf-dev` / `lendshelf-prod` projects. The only emulator is the throwaway one the backend tests start.

| Path | What |
|---|---|
| `../firebase.json`, `../.firebaserc` | Functions source, rules files; project aliases `dev` and `prod` (no default project). |
| `../firebase.test.json` | Test-only config: the same, plus the emulator ports the test scripts use (no UI). |
| `../firestore.rules`, `../storage.rules`, `../firestore.indexes.json` | Security rules and indexes |
| `src/index.ts` | Function exports (wiring only) |
| `src/handlers/*` | One module per area: account, contacts, books, shelves, loans, triggers, maintenance |
| `src/lib/*` | Pure helpers: loan state machine, phone/ISBN normalisation, book lookup (injectable `fetch`), push sending (injectable transport) |
| `src/model.ts` | Firestore document types (mirrors SPEC §3) |
| `test/unit`, `test/rules`, `test/integration` | Vitest suites |
| `scripts/firebase.mjs` | Runs the local `firebase-tools` with a Java 21+ runtime (see below) |

## Requirements

- Node 22, npm 10. `npm install` here installs `firebase-tools` locally; no global install is needed.
- **Java 21 or newer** for the test emulators (firebase-tools 15 refuses older Java; deploying doesn't need Java). `scripts/firebase.mjs` uses `JAVA_HOME` / `PATH` if it is new enough, otherwise it looks for a newer JDK (Android Studio's bundled JBR, common JDK folders) or `LENDSHELF_JAVA_HOME`. On Windows it also sets `-Djdk.net.unixdomain.tmpdir=functions/.tmp`, which fixes the Firestore emulator crashing with "Unable to establish loopback connection". It also sets `FUNCTIONS_DISCOVERY_TIMEOUT=60` (seconds; the default 10 s is too short on a busy machine).

## Commands

Run from the repo root with `npm --prefix functions run <script>`, or from this folder with `npm run <script>`.

| Script | What it does |
|---|---|
| `build` | `tsc` to `lib/` (strict) |
| `test:unit` | Pure helper tests. No emulators. |
| `test:rules` | Firestore + Storage rules tests (starts its own throwaway emulators via `emulators:exec`) |
| `test:integration` | Build, then call the functions, loaded in the throwaway emulator, with the Firebase JS SDK |
| `test` | All three |
| `firebase -- <args>` | Any firebase-tools command with the right Java, e.g. `npm run firebase -- functions:log --project dev`. Always pass `--project`: there is no default project. |
| `deploy:dev`, `deploy:prod` | Deploy Firestore rules + indexes, Storage rules and all functions to `lendshelf-dev` / `lendshelf-prod`. See "Deploying to dev / prod". |
| `deploy:{dev,prod}:dry-run` | Same, with `--dry-run` (validates and builds, deploys nothing; **does** enable missing APIs, so only after Blaze) |
| `deploy:{dev,prod}:firestore` / `:storage` / `:functions` | One part only |

The emulator is test infrastructure only. The `test*` scripts start it from `../firebase.test.json` with `--project demo-lendshelf` (a `demo-*` id can't reach any real project), wipe its data between tests and stop it when they finish. Ports: Auth 19099, Firestore 18080 (websocket 19150), Functions 15001, Storage 19199, hub 14400, logging 14500, Eventarc 19299, Tasks 19499; they must be free. The integration helpers read the Functions port from the emulator hub.

## Deploying to dev / prod

Aliases in `../.firebaserc`: `dev` = `lendshelf-dev`, `prod` = `lendshelf-prod`. There is no default project, so a bare `firebase deploy` errors instead of picking one. Every deploy script names its project; nothing deploys to prod unless the script name says `prod`. Run them from the repo root (`npm run deploy:dev`) or from this folder.

### What the code needs from a real project

| Item | Status |
|---|---|
| Params / secrets | None. No `defineString`/`defineSecret`, so Secret Manager is not used. The only env var is `ENFORCE_APP_CHECK`, read from `.env.dev` / `.env.prod` (both `false`). |
| Callables (16) | v2 (Cloud Run), `asia-south1`, `maxInstances: 10` each |
| `onItemWritten` | v2 Firestore trigger via Eventarc. The trigger region must match the database: both are `asia-south1`. |
| `dailyMaintenance` | v2 schedule: one Cloud Scheduler job in `asia-south1`, 09:00 Asia/Kolkata |
| `onUserCreated` | v1 (1st gen) Auth trigger: v2 has no non-blocking "user created" event |
| Push | Expo push API: no server key in the functions. Delivery needs the FCM V1 service-account key (Android) and APNs key (iOS) uploaded to the Expo/EAS project. If you turn on Expo's "enhanced push security", the functions would need an Expo access token (not supported today). |
| Storage bucket | Taken from `FIREBASE_CONFIG` at deploy time (`lendshelf-<env>.firebasestorage.app`); only `deleteAccount` uses it. |
| Test-only code | The `_testPushes` recorder (`isTestEmulator()` in `src/lib/context.ts`) runs only when `FUNCTIONS_EMULATOR=true` (set only by the emulator, never by Cloud) **and** the project id starts with `demo-`, so real pushes always go to Expo. No project id is hard-coded in `src/`. |

### State on 2026-11-21 (both projects on Blaze)

Done in both: Firestore `(default)` in `asia-south1` with rules and indexes; Auth with the Phone provider (SMS limited to India; dev also has test numbers +919000000001..5, codes in firebase-config/TEST-NUMBERS.md or the console); Android/iOS/web apps; the Storage bucket `lendshelf-<env>.firebasestorage.app` in **`us-central1`** (inside Cloud Storage's free tier) with `storage.rules`; all 19 functions. Dev was checked end to end: sign-in with a test number, `onUserCreated`, `completeProfile`, `syncContacts`.

`secretmanager` stays off (nothing uses it). `firebaseappcheck` turns on when you open App Check in the console. Neither project has an App Engine app or an organization.

### First deploy, in order (do dev completely, then prod)

1. **Upgrade the project to Blaze and set a budget alert** (see below).
2. **Create the Storage bucket:** Console → Storage → Get started → location `us-central1` (the free tier only covers US buckets; cover photos are small and cached, so the distance doesn't matter), production-mode rules. Both existing projects already have theirs. Do this before deploying, because `deploy:dev` includes `storage` and fails without a bucket, and `deleteAccount` would leave cover photos behind (it only logs a warning).
3. **`npm run deploy:dev:dry-run`**: builds, discovers the functions and turns on the missing APIs (answer yes if asked). It prints the IAM roles the real deploy will grant. It deploys nothing.
4. **`npm run deploy:dev`**: deploys Firestore rules and indexes, Storage rules and all 19 functions. On the first run it asks how many days to keep container images in Artifact Registry: answer `1`. You can set this later with `npm run firebase -- functions:artifacts:setpolicy --project dev`. If it asks whether to delete indexes that aren't in `firestore.indexes.json`, answer no unless you know why they're there.
5. **Check it:**
   - `npm run firebase -- functions:list --project dev` lists 19 functions.
   - Sign in on a dev build with test number +919000000001 (code in firebase-config/TEST-NUMBERS.md). `users/{uid}`, `phoneIndex/+919000000001` and `shelves/default_{uid}` should appear (that's `onUserCreated`).
   - Read the logs with `npm run firebase -- functions:log --project dev`.
   - Cloud Scheduler shows `firebase-schedule-dailyMaintenance-asia-south1`. "Force run" it once to test.
6. **Prod:** repeat steps 1–5 with `prod` (`npm run deploy:prod:dry-run`, then `npm run deploy:prod`). Prod has no test phone numbers.

To redeploy only one part, run `deploy:{dev,prod}:firestore`, `:storage` or `:functions`.

### First-deploy IAM gotchas

The first deploy needs three roles: Pub/Sub service agent → Service Account Token Creator, and the default compute service account → Cloud Run Invoker and Eventarc Event Receiver. On both LendShelf projects the CLI failed to add them itself ("We failed to modify the IAM policy"), because the service agents only appear partway through that first run. What worked: let the first deploy fail, add the three roles (the CLI prints the exact `gcloud projects add-iam-policy-binding` commands; or IAM in Cloud Console), wait about 5 minutes, deploy again. On the retry `onUserCreated` (1st gen) and `onItemWritten` can still fail once on propagation ("failed to ensure registry read/write access", "Permission denied while using the Eventarc Service Agent"); a third run a few minutes later succeeds. If something else fails:

- **Eventarc "Permission denied while using the Eventarc Service Agent"** (or "Invalid resource state") on `onItemWritten`: new service agents take a few minutes to propagate. Wait 5–10 minutes, then run `deploy:dev:functions` again.
- **Cloud Build "missing permission on the build service account"**: new projects build as the default compute service account. Grant it the builder role:
  `gcloud projects add-iam-policy-binding lendshelf-dev --member=serviceAccount:178098625183-compute@developer.gserviceaccount.com --role=roles/cloudbuild.builds.builder`
  For prod use `lendshelf-prod` and `127074938608`.
- **"Service account …-compute@developer.gserviceaccount.com does not exist"**: turn on the Compute Engine API. Turning it on is free (you pay only for VMs) and creates that account. Then deploy again.
- **`onUserCreated` (1st gen) runs as `<project-id>@appspot.gserviceaccount.com`.** If the deploy says that account doesn't exist, follow the error's fix: turn the Cloud Functions API off and on again, which is harmless before any function is deployed. Or give that one function a `serviceAccount` in `runWith`.
- You need `iam.serviceAccounts.actAs` on those accounts. Owner has it; a less privileged deployer needs "Service Account User".

### Secrets

None are used today. To add one, declare `defineSecret("NAME")` in code and pass it in the function's `secrets` option. Then run `npm run firebase -- functions:secrets:set NAME --project dev` (it prompts for the value and turns on Secret Manager), and redeploy. Never put secrets in `.env*` files: `.env.dev` and `.env.prod` are committed.

### App Check

`ENFORCE_APP_CHECK` is set per project in `functions/.env.dev` and `functions/.env.prod`. Both are `false`, so callables accept requests without a token. To turn it on for a project:
1. Register the apps in Console → App Check (Play Integrity, App Attest/DeviceCheck, reCAPTCHA Enterprise for web).
2. Ship an app build that sends App Check tokens.
3. Set `ENFORCE_APP_CHECK=true` in that project's file.
4. Run `deploy:<env>:functions`.

### Budget alert

Blaze has no spending cap; a budget only sends alerts. Before the first deploy, create a budget for each project in Cloud Console → Billing → Budgets & alerts (also reachable from Firebase Console → Usage and billing). Scope it to that one project, set a small monthly amount (for example the equivalent of US$5 for dev), and send email alerts at 50%, 90% and 100%. At LendShelf's scale the expected bill is close to zero:

- Cloud Run/Functions free tier: 2M requests a month.
- Cloud Scheduler: 3 free jobs per billing account. This project uses 1 job per project.
- Artifact Registry: 0.5 GB free. The cleanup policy keeps images under that.
- Storage: the buckets are in `us-central1`, which has Cloud Storage's free tier (5 GB-months, plus free operations and egress allowances). Buckets in other regions, such as `asia-south1`, are billed from the first byte.

`maxInstances: 10` caps how far a traffic spike or a loop can scale.

## Functions

All callables require a signed-in user. Errors are `HttpsError`s (`invalid-argument`, `not-found`, `permission-denied`, `failed-precondition`, `already-exists`, `resource-exhausted`, `unavailable`, `unauthenticated`, `internal`) with a user-readable message and no internal details.

**App Check** is opt-in: set `ENFORCE_APP_CHECK=true` (per project in `functions/.env.dev` / `functions/.env.prod`, both `false` today) to make every callable reject requests without a valid App Check token. It is off by default so the backend tests and current builds work. **Set up App Check in the app and turn this on before production.** Dates in requests are ISO 8601 strings; dates in responses don't appear (callers read Firestore).

| Name | Type | Request → Response | Notes |
|---|---|---|---|
| `onUserCreated` | Auth trigger (v1) | — | Creates `users/{uid}`, `phoneIndex/{phone}`, default shelf `shelves/default_{uid}` ("My books", public). Idempotent. |
| `completeProfile` | callable | `{ name, pickupNote?: string \| null }` → `{ ok: true }` | Name trimmed, 1–60. `pickupNote` ≤ 200; omit to keep the current one, `null`/`""` to clear. Also re-creates `users`/`phoneIndex`/default shelf if missing. |
| `syncContacts` | callable | `{ phones: string[], replace?: boolean }` (≤ 5000) → `{ links: { ownerId, ownerPhone, name: string \| null }[], skippedRemovals: number }` | Numbers should be E.164; 10-digit Indian numbers, `0`-prefixed and `00` prefixes are also normalised. Replaces the caller's links (adds new, deletes missing). **Shrink guard:** without `replace: true`, a sync that would delete more than half of the caller's existing links still adds/updates matches but deletes nothing, and returns `skippedRemovals` = the number kept (0 otherwise). `links` is the caller's links after the call (matches plus any kept). Sorted by name. At most 20 calls per user per rolling 24 h (`resource-exhausted`), counted in the backend-only `rateLimits/{uid}`. |
| `resolveBook` | callable | `{ isbn }` \| `{ olWorkKey, isbn? }` \| `{ gbVolumeId, isbn? }` → `{ workId, work, edition }` | ISBN-10 or -13 (hyphens OK). `work` = Work fields without timestamps. `edition` = `{ isbn: string \| null (ISBN-13), coverUrl, language (e.g. "en"), publisher, publishYear }`. `not-found` means "offer a custom book". With `olWorkKey`/`gbVolumeId`, an `isbn` is only used (returned and cached in `isbnIndex`) if it belongs to that work (the Open Library edition's work matches, or the Google Books volume lists it); otherwise `edition.isbn` is `null`. Catalogue requests time out after 8 s; an Open Library failure or timeout falls back to Google Books. |
| `setShelfVisibility` | callable | `{ shelfId, isPublic }` → `{ updated }` | `updated` = number of items whose `sharedWithContacts` changed. |
| `deleteShelf` | callable | `{ shelfId, moveToShelfId }` → `{ moved }` | Both shelves must be the caller's and different. |
| `requestLoan` | callable | `{ itemId, message?: string \| null }` → `{ loanId, ownerPhone }` | `message` ≤ 500. Use `ownerPhone` for the WhatsApp deep link. |
| `respondToRequest` | callable | `{ loanId, accept, dueDate?: ISO \| null, reason?: "readingIt" \| "notLending" \| "lentToSomeoneElse" \| null }` → `{ ok: true }` | Default due date +21 days. Decline: `reason` (optional) is stored as `declineReason` and picks the push text; `lentToSomeoneElse` also creates the borrower's back-watch `watches/{uid}_back_{itemId}`. Accepting declines other open requests for the copy with `declineReason: "lentToSomeoneElse"`, a back-watch for each of those borrowers and the push "<title> went to someone else. We'll tell you when it's back." A request older than 7 days becomes `expired` (error `failed-precondition`). |
| `cancelRequest` | callable | `{ loanId }` → `{ ok: true }` | Borrower, `requested` only. |
| `recordLoan` | callable | `{ itemId, borrowerName, borrowerPhone?: string \| null, dueDate?: ISO \| null }` → `{ loanId }` | Owner lends directly. `borrowerPhone` is matched to an app user via `phoneIndex` (sets `borrowerUid`). Declines open requests for the copy, as an accept does (`lentToSomeoneElse`, back-watch, push). The matched borrower gets pushes about this loan (lent to you, due soon, overdue, review prompt) only if they have the owner saved. |
| `markReturned` | callable | `{ loanId }` → `{ ok: true }` | Borrower: `active` → `returnPending`. |
| `confirmReturn` | callable | `{ loanId, reason?: "returned" \| "notCollected" \| null }` → `{ ok: true }` | Owner: `active`/`returnPending` → `returned`. Notifies `back` watchers who have the owner saved (only if the copy is shared) with "Book is back", then deletes all `back` watches on the copy; asks the borrower for a review (if they have the owner saved). `reason: "notCollected"` (owner, `active` only): → `cancelled` with `closedReason: "notCollected"`, copy available, **no** review prompt, and the same watchers get "<title> is available again" (`availableAgain`) instead; watches are deleted the same way. |
| `markNotReturned` | callable | `{ loanId }` → `{ ok: true }` | Owner: "Not back yet", `returnPending` → `active`, `returnMarkedAt` → `null` (daily reminders apply again). Pushes the borrower "<owner> hasn't got <title> back yet." (`notBackYet`) if they have the owner saved. |
| `updateDueDate` | callable | `{ loanId, dueDate: ISO }` → `{ ok: true }` | Owner, `active` loans. Pushes the borrower "<owner> changed the due date for <title> to <d MMM>." (`dueChanged`) if they have the owner saved. |
| `registerPushToken` | callable | `{ token }` (Expo push token) → `{ ok: true }` | Adds the token to the caller's `users.pushTokens` (moved to the end if already there) and removes it from any other user (one account per device). Keeps the 20 newest; the oldest is dropped. `failed-precondition` if the `users` doc doesn't exist yet. |
| `unregisterPushToken` | callable | `{ token }` → `{ ok: true }` | Removes the token from the caller's `pushTokens` (call on sign-out). |
| `deleteAccount` | callable | `{}` → `{ ok: true, deleted: Record<string, number> }` | See "Account deletion" below. The client should sign out afterwards. |
| `onItemWritten` | Firestore trigger `items/{itemId}` | — | When a copy becomes `sharedWithContacts`, pushes "<owner> added <title>" to wishlist watchers of the Work who have the owner saved. When a copy is deleted, its `requested` loans become `cancelled` and the borrowers get "<owner> removed <title>" (`data.type` `itemRemoved`). |
| `dailyMaintenance` | schedule `0 9 * * *` Asia/Kolkata | — | Only `requested` and `active` loans are read, so `returnPending`, `ownerLeft` and closed loans get no reminders. Expires `requested` loans ≥ 7 days old (only if unchanged since read: `lastUpdateTime` precondition); "due soon" (24–48 h before; says "tomorrow" or "in 2 days" by India calendar days) and "overdue" (first day, then weekly) reminders. Logic: `runDailyMaintenance(deps)` in `src/handlers/maintenance.ts`. |

Due dates: a date-only string like `"2026-12-12"` is midnight UTC that day. Due dates can't be in the past (today is allowed) or more than a year ahead.

### Push notifications

`sendPush(uids, { title, body, data })` reads `users/{uid}.pushTokens` (Expo tokens) and POSTs to `https://exp.host/--/api/v2/push/send` in batches of 100. Every push has `data.type` (`loanRequested`, `requestAccepted`, `requestDeclined`, `lentToYou`, `markedReturned`, `reviewPrompt`, `itemBack`, `availableAgain`, `wishlistAdded`, `itemRemoved`, `requestExpired`, `dueSoon`, `overdue`, `notBackYet`, `dueChanged`, `ownerLeft`) plus `loanId` / `itemId` / `workId` for routing taps. `requestDeclined` also carries `reason` when there is one.

Expo push tickets are read: a token whose ticket says `DeviceNotRegistered` is removed from every `users` doc that holds it. (Receipts are not polled.)

Test support: in the test emulator (`FUNCTIONS_EMULATOR=true` and a `demo-*` project) nothing is sent: each push is written to the `_testPushes` collection (closed to clients by the rules), which the integration tests read.

### Account deletion

Deletes the caller's items, shelves, reviews, watches, custom works, links (as viewer and owner), profile, `users` doc, `rateLimits` doc, `phoneIndex` entry, `covers/{uid}/` files and the Auth user. If any Firestore write fails it stops before deleting the files and the Auth user and returns `internal` ("please try again"); every step is safe to repeat. Other people's `back` watches on their copies are removed. Loans they **owned**: lent to a non-app person → deleted; otherwise `ownerPhone` is blanked (the name is kept) and `requested` → `cancelled`, `active`/`returnPending` → `ownerLeft` (terminal, no reminders). Each `ownerLeft` borrower who has the owner saved gets one push, title "<owner> left LendShelf" (`ownerLeft`); pushes are sent only for writes that landed, so a retried deletion doesn't repeat them. Loans they **borrowed**: `borrowerUid` → `null`, name and phone kept so the owner can get the book back; open requests → `cancelled`.

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

Write rules: `items.loanState`, `dueDate`, `activeLoanId` are backend-only (must be `available`/`null`/`null` on create and unchanged on update); `sharedWithContacts` must equal `shelf.isPublic && visibility != "hidden"` (checked with `getAfter`, so a shelf and its first copy can be written in one batch); a copy of a custom work (`custom_` id) must use the caller's own custom work, while a catalogue copy (`ol_`/`gb_` id, `isCustom == false`) needs no work read; a lent copy can't be deleted. `createdAt`/`updatedAt` must be `serverTimestamp()` (`createdAt` on create, `updatedAt` on every write) for items, custom works, shelves, reviews and profiles, and a watch's `createdAt` on create. `authors` (items, custom works) is a list of at most 20 strings of at most 300 characters. `coverUrl` is `null` or starts with `https://covers.openlibrary.org/`, `https://books.google.com/`, `https://books.googleusercontent.com/`, or `https://firebasestorage.googleapis.com/` (no local or `http://` URLs). Uploaded covers must be JPEG, PNG, WebP or HEIC/HEIF (no SVG). Shelf `isPublic` changes and shelf deletes go through the callables. `users` docs: the client may only change `pushTokens`. `phoneIndex`, `isbnIndex`, `links`, `loans` are not client-writable.

**Batch size for new copies.** Firestore allows 20 document reads (`get`/`getAfter`/`exists`) per batched write. A new copy reads its shelf (counted once per batch) and, only for an *existing* custom work, that work; catalogue copies and custom works created in the same batch add nothing. So one batch can hold at most **19 copies of distinct existing custom works**; chunking adds at 19 copies per batch (each with its new custom work, if any) is always safe. Pinned by the "batch sizes" rules tests.

Uids must not contain `_` (Firebase Auth uids never do): review and watch ids are split on `_` by the rules.
