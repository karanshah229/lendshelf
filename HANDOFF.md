# Handoff — LendShelf

## 2026-11-21 update

The UX v1.1 and environment changes are in commit `fd901b7`.

**UX v1.1.** The app now follows [docs/ux/UX-FLOWS.md](docs/ux/UX-FLOWS.md): Home with "Needs you", an urgency-sorted Loans ledger, a Loan screen, decline reasons, not-collected / not-returned / owner-left states, a contacts shrink guard, first-run and invite flows, and an accessibility pass. The end-to-end QA run and its fixes are in [docs/ux/QA-V1.1.md](docs/ux/QA-V1.1.md). That QA run used the emulators and demo users, which have since been removed.

**Phone testing.** Release APKs (arm64-v8a) install on a physical phone over USB and talk to `lendshelf-dev`. Steps are in README → *Android build*. Fixed while testing on a phone:

- The placeholder API key got the shape Firebase expects; the native Functions SDK rejected every callable with the old one. (The placeholder config files have since been deleted.)
- Onboarding waits for a saved name, not just any profile document.
- The keyboard no longer covers footer buttons on Android.

**Emulator mode and seed data removed.** The app has no emulator mode any more: no "Use code from emulator" button, no Emulator badge, no `adb reverse`, no `ACCESS_LOCAL_NETWORK` permission and no cleartext traffic. The `emulators`, `seed` and `dev:web:real` scripts are gone, and `npm run dev:web` now runs the web app against dev. The demo users (Asha, Ravi, Meera, Kabir, Zoya) and their ~70 books are deleted, so dev starts empty. The backend tests still start a private, throwaway emulator (`firebase.test.json`, `--project demo-lendshelf`; needs Java 21). The Firestore rules now accept cover URLs only from the https catalogue hosts and `firebasestorage.googleapis.com`.

**Firebase environments.** `APP_ENV` picks `dev` (`lendshelf-dev`, the default) or `prod` (`lendshelf-prod`, never implicit) at build time. App configs live in the git-ignored `firebase-config/<env>/`, downloaded with `npm run firebase:config`. The root placeholder `google-services.json` and `GoogleService-Info.plist` are deleted. See README → *Environments*.

| Set up and deployed in both projects | Dev only |
|---|---|
| Blaze plan | Test numbers +91 90000 00001 to 05 (code in `firebase-config/TEST-NUMBERS.md` or the Firebase console) |
| Firestore (`asia-south1`), rules and indexes | SHA-1 / SHA-256 of the React Native debug keystore |
| Phone auth, SMS limited to India | |
| 19 Cloud Functions (`asia-south1`) | |
| Storage bucket (`us-central1`, inside the free tier) and rules | |
| Android, iOS and web apps (`com.lendshelf.app`) | |

**Checked on dev.** Dev passed an end-to-end check on web: sign-in with a test number, account setup, saving a name and contact matching.

**Blockers (owner action needed):**

| Blocker | Effect | Fix |
|---|---|---|
| Prod has no signing key fingerprints | Phone sign-in doesn't work on prod | Add the release and Play app signing SHA-1 / SHA-256 |
| EAS isn't set up | No cloud builds; `firebase-config/` isn't available to EAS | `eas init`, then pass the config files to EAS (e.g. file environment variables) |

The full list is in README → *Going live*. Deploy steps are in [functions/README.md → Deploying to dev / prod](functions/README.md#deploying-to-dev--prod).

---

## Earlier handoff (v1, emulators only)

> **Outdated.** This section describes the first build, which ran on local emulators with seeded demo users. Emulator mode, the seed script and the demo users have since been removed, so the run instructions below (Emulator UI, `npm run seed`, demo numbers, the emulator demo APK) no longer work. Use README → *Run it locally* instead. It is kept as a record of what was built and checked at the time.

The app is built, tested and running locally on the Firebase emulators. It works on web and on the Android emulator. Nothing is deployed, and no real Firebase, Expo or Apple accounts were created or used.

![Discover on Android](docs/screenshots/android-discover.png)

## What was running then (outdated)

| Thing | Where | Notes |
|---|---|---|
| Firebase emulators | Emulator UI at http://127.0.0.1:4000 | Seeded demo data, plus changes made during QA |
| Web app (dev) | http://127.0.0.1:8081 | Sign in with 9000000001 (Asha) … 9000000005 (Zoya), then **Use code from emulator** |
| Android emulator | `Medium_Phone_API_37.0` window | The demo APK is installed and signed in as Asha |
| Demo APK | `dist-apk/lendshelf-emulator-demo.apk` | x86_64, emulator mode, JS bundled, not committed |

The Firebase emulators, demo users and emulator-mode builds are gone. `dist-apk/` (git-ignored) still holds `lendshelf-emulator-demo.apk`; it needs the removed emulator mode and won't work.

## What was verified

| Area | How | Result |
|---|---|---|
| Backend: rules, 15 callables, triggers, maintenance | 169 tests (unit, rules, integration) against emulators | Pass |
| App logic | 208 Jest tests, strict TypeScript, ESLint | Pass |
| Every v1 flow, end to end | A QA agent drove the web build as 5 users (12 flows: borrow → accept → return, one-way visibility, private collections, add by search/ISBN/hand, owner actions, lend to non-app person, reviews, wishlist push, export, delete account) | All pass; 6 bugs found and fixed |
| Security and code review | An independent reviewer read the whole codebase | 1 critical, 2 high and 8 medium issues; all fixed except where noted below |
| Native Android | Debug and release builds on the API 37 emulator: sign-in, Discover, Book, Copy, My books, Loans, Me | Works |

## Not verified yet

- **iOS**: no Mac here, so nothing was built for iOS.
- **Real phone sign-in**: needs a real Firebase project (Play Integrity / reCAPTCHA, APNs).
- **Camera barcode scanning, photo upload and real push notifications** on a device. Push also needs `eas init` first; until then registration is skipped.
- **Real address-book sync** (the emulator has no contacts).
- **ARM builds** for real Android phones (only x86_64 was built).
- The Loans-tab dev-mode crash fix (src/features/loans/segmented.tsx) passed typecheck and tests but wasn't re-run in an Android debug build. Release builds never had the crash.

## What you need to do to put it on phones

Steps 1 and 2 are done (see the 2026-11-21 update above); README → *Going live* has the current list. As written then:

1. ~~Create a Firebase project on the Blaze plan. Enable Phone auth, Firestore (`asia-south1`) and Storage. Add Android and iOS apps (`com.lendshelf.app`), then replace `google-services.json` and `GoogleService-Info.plist`.~~ Done as `lendshelf-dev` and `lendshelf-prod`; configs now come from `firebase-config/<env>/`.
2. ~~Deploy the rules, indexes and functions.~~ Done on both projects.
3. Run `npx eas-cli init`, then build an APK (`eas build -p android --profile preview`) and an iOS build for TestFlight.

## Decisions I made while you slept

All of them are in [DECISIONS.md](DECISIONS.md) (37 rows). The ones you might want to revisit:

- The name **LendShelf** and the app id `com.lendshelf.app`.
- `syncContacts` is limited to 20 calls per user per day, to slow down number probing.
- Pushes about a loan the owner recorded reach the borrower only if the borrower has the owner saved.
- Borrow requests expire after 7 days. The default due date is 3 weeks; due dates can be up to 1 year out.
- Reminders are sent the day before a book is due, then on the first overdue day, then weekly.
- Offline data is not cleared on sign-out (DECISIONS row 29 explains why).

## Housekeeping

- An empty folder `D:\tmp-jdk` was left behind by the backend build. A safety rule stopped me deleting it; you can remove it.
- Building Android on Windows needs a newer CMake/ninja than the SDK default (README → *Android build*).
- A one-time scheduled task, "Resume LendShelf overnight build", was set as a safety net in case the usage limit was hit. It checks `PROGRESS.md` and exits when the status is `DONE`.
