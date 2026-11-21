# LendShelf

A private lending library for friends and family. Everyone lists the books they own; anyone who has your number saved in their phone can see your shared books, ask to borrow them, and read reviews. WhatsApp is where people talk — LendShelf is the system of record.

- **Product and system spec:** [SPEC.md](SPEC.md)
- **Decisions made during the build:** [DECISIONS.md](DECISIONS.md)
- **Backend details (functions, payloads, tests):** [functions/README.md](functions/README.md)

## Features (v1)

- Phone number sign-in (SMS code)
- One-way contact matching: if you have someone's number saved, you see their shared books
- Add books by ISBN scan (continuous), title/author search (Open Library), or by hand
- Collections (public or private); each copy is lendable, visible-only or hidden
- Borrow requests → WhatsApp with a prefilled message; owners accept, set due dates, confirm returns
- Lend to people who aren't on the app
- Reviews belong to the Book (not the copy); you see reviews from people you've saved
- Wishlist ("tell me when someone I know adds this") and "notify me when it's back"
- Push reminders for due/overdue books, plus a "Nudge on WhatsApp" button
- CSV / JSON export, in-app account deletion, light and dark mode

## Stack

Expo SDK 58 (React Native, Expo Router, TypeScript strict) · NativeWind + React Native Reusables (shadcn/ui for RN) · React Native Firebase on Android/iOS, Firebase JS SDK on web (dev/demo only) · Cloud Functions v2 (Node 22, `asia-south1`) · Firestore · Cloud Storage · Expo push.

## Run it locally (no Firebase account needed)

Everything runs on the Firebase Emulator Suite with the demo project `demo-lendshelf`.

Prerequisites: Node 22, npm, Java 21+ (Android Studio's bundled JBR is detected automatically), Android SDK for the Android build.

```powershell
npm install
npm --prefix functions install
```

Start the emulators (keep this running):

```powershell
npm run emulators
```

In a second terminal, load demo data (5 users, ~70 books, loans in every state, reviews):

```powershell
npm run seed
```

Start the web app (dev/demo build, talks to the emulators):

```powershell
npm run dev:web
```

Open http://localhost:8081, sign in with one of the demo numbers, and tap **Use code from emulator** on the code screen.

| Demo user | Number |
|---|---|
| Asha Rao | 9000000001 |
| Ravi Menon | 9000000002 |
| Meera Iyer | 9000000003 |
| Kabir Shah | 9000000004 |
| Zoya Khan | 9000000005 |

Zoya has Asha saved, but Asha doesn't have Zoya — useful for checking one-way visibility. The Emulator UI is at http://127.0.0.1:4000.

### Android (emulator)

See [Android build](#android-build) below.

## Checks

```powershell
npm run typecheck
```

```powershell
npm run lint
```

```powershell
npm test
```

```powershell
npm --prefix functions test
```

The backend suite runs its own emulators on shifted ports, so it works while `npm run emulators` is running.

## Project layout

| Path | What's there |
|---|---|
| `src/app/` | Expo Router routes: `(auth)` sign-in, `(onboarding)`, `(app)/(tabs)` Discover · My books · Loans · Me, plus book, copy, person, add, shelves, lend, review, wishlist, privacy |
| `src/components/ui/` | shadcn-style components (React Native Reusables) |
| `src/features/` | Feature modules (add, book, copy, discover, loans, me, export, …) |
| `src/lib/firebase/` | `index.ts` (web, JS SDK) and `index.native.ts` (React Native Firebase) with the same API |
| `src/hooks/`, `src/stores/` | Data hooks (Firestore listeners) and zustand stores |
| `functions/` | Cloud Functions, rules tests, integration tests, seed script |
| `firestore.rules`, `storage.rules` | Security rules |

## Going live (what you need to do)

1. **Create a Firebase project** (Blaze plan — Cloud Functions require it; set a budget alert).
   - Enable **Authentication → Phone**.
   - Create **Firestore** (region `asia-south1`) and **Storage**.
2. **Register the apps** with id `com.lendshelf.app`:
   - Android: add the SHA-1 and SHA-256 of your signing key (EAS shows them; needed for phone auth). Download `google-services.json` and replace the placeholder in the repo root.
   - iOS: download `GoogleService-Info.plist` and replace the placeholder.
3. **Deploy the backend**: set the project in `.firebaserc`, then deploy rules, indexes and functions (`npm --prefix functions run deploy`, see functions/README.md).
4. **Expo / EAS**: run `npx eas-cli init` (adds `extra.eas.projectId` — push notifications are skipped until this exists), upload FCM v1 credentials for Android push and let EAS manage the APNs key for iOS.
5. **Builds for testers**:
   - Android APK: `npx eas-cli build -p android --profile preview` (or build locally, see below) and send the APK.
   - iOS: `npx eas-cli build -p ios` then `npx eas-cli submit -p ios` to TestFlight (needs your Apple Developer account).
6. **Before wider release**: turn on App Check (see functions/README.md), add a Google Books API key, and review the privacy policy screen.

## Android build

_Filled in after the native build is verified._
