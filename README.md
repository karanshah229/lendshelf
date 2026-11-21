# LendShelf

A private lending library for friends and family. Everyone lists the books they own; anyone who has your number saved in their phone can see your shared books, ask to borrow them, and read reviews. WhatsApp is where people talk — LendShelf is the system of record.

- **Product and system spec:** [SPEC.md](SPEC.md)
- **Decisions made during the build:** [DECISIONS.md](DECISIONS.md)
- **Backend details (functions, payloads, tests, deploys):** [functions/README.md](functions/README.md)

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

Expo SDK 58 (React Native, Expo Router, TypeScript strict) · NativeWind + React Native Reusables (shadcn/ui for RN) · React Native Firebase on Android/iOS, Firebase JS SDK on web (development only) · Cloud Functions v2 (Node 22, `asia-south1`) · Firestore · Cloud Storage · Expo push.

## Run it locally

The app always talks to a real Firebase project. Locally that is `lendshelf-dev`. There is no emulator mode and no demo data: dev starts empty, and you create accounts by signing in.

Prerequisites: Node 22, npm, and a Google account with access to `lendshelf-dev`. Java 21+ is only needed for the backend tests, and the Android SDK only for the Android build.

```powershell
npm install
npm --prefix functions install
```

Log in to Firebase. `npm run firebase:config` uses the Firebase CLI installed in `functions/`; a global `firebase login` works too.

```powershell
npm --prefix functions run firebase -- login
```

Download the app configs into `firebase-config/` (git-ignored):

```powershell
npm run firebase:config
```

Start the web app against dev:

```powershell
npm run dev:web
```

Open http://localhost:8081 and sign in with a dev test number, +91 90000 00001 to 05. These numbers don't send an SMS. Their code is in `firebase-config/TEST-NUMBERS.md` (git-ignored) or in the Firebase console (Authentication → Sign-in method → Phone).

Web has no address book, so the Contacts screen lets you add numbers by hand. To see contact matching, sign in with two test numbers and add one to the other.

## Environments

`APP_ENV` picks the Firebase project when the app is bundled or prebuilt (app.config.ts).

| Env | Firebase project | Selected when | App config comes from | Run / build |
|---|---|---|---|---|
| `dev` | `lendshelf-dev` | `APP_ENV=dev`, or `APP_ENV` not set (the default) | `firebase-config/dev/` | `npm run dev:web`; Android: [Android build](#android-build) |
| `prod` | `lendshelf-prod` | Only `APP_ENV=prod` (never implicit) | `firebase-config/prod/` | `APP_ENV=prod` builds; phone sign-in doesn't work yet (see [Going live](#going-live)) |

Notes:

- `npm run firebase:config` downloads both environments. `npm run firebase:config -- dev` fetches one only.
- `npm start`, `npm run web` and `npm run android` with no variables build against `dev`.
- app.config.ts stops with an error if `APP_ENV` is anything other than `dev` or `prod`, or if the config files for that environment are missing.
- Dev has the test numbers above. Prod has none.

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

The backend tests start their own throwaway Firebase emulator from `firebase.test.json` with `--project demo-lendshelf`, so they never touch dev or prod. This emulator is test infrastructure only; the app never uses it. It needs Java 21 or newer. `functions/scripts/firebase.mjs` uses `JAVA_HOME` or `java` on `PATH` if it is new enough; otherwise it looks for Android Studio's bundled JBR, common JDK folders or `LENDSHELF_JAVA_HOME`. Ports and details are in [functions/README.md](functions/README.md).

## Project layout

| Path | What's there |
|---|---|
| `src/app/` | Expo Router routes: `(auth)` sign-in, `(onboarding)`, `(app)/(tabs)` Discover · My books · Loans · Me, plus book, copy, person, add, shelves, lend, review, wishlist, privacy |
| `src/components/ui/` | shadcn-style components (React Native Reusables) |
| `src/features/` | Feature modules (add, book, copy, discover, loans, me, export, …) |
| `src/lib/firebase/` | `index.ts` (web, JS SDK) and `index.native.ts` (React Native Firebase) with the same API |
| `src/hooks/`, `src/stores/` | Data hooks (Firestore listeners) and zustand stores |
| `functions/` | Cloud Functions, rules tests, integration tests, deploy scripts |
| `firestore.rules`, `storage.rules` | Security rules |
| `firebase.json`, `.firebaserc` | Deploy config; aliases `dev` and `prod`, no default project |
| `firebase.test.json` | The backend tests' throwaway emulator (shifted ports, no UI) |
| `scripts/` | `firebase-config.mjs` (`npm run firebase:config`) |
| `firebase-config/<env>/` | Real app configs for `dev` and `prod` (git-ignored, downloaded) |
| `docs/ux/` | UX v1.1 flows, review, QA run and screenshots |

## Going live

### Done

| Item | `lendshelf-dev` | `lendshelf-prod` |
|---|---|---|
| Plan | Blaze | Blaze |
| Firestore in `asia-south1`, rules and indexes deployed | Yes | Yes |
| Phone auth on, SMS limited to India (IN) | Yes | Yes |
| All 19 Cloud Functions deployed in `asia-south1` | Yes | Yes |
| Storage bucket in `us-central1` (inside the free tier), rules deployed | Yes | Yes |
| Android, iOS and web apps registered (`com.lendshelf.app`) | Yes | Yes |
| Test phone numbers (+91 90000 00001 to 05) | Yes | No |
| SHA-1 / SHA-256 of the signing key | Standard React Native debug keystore | Not yet |
| End-to-end check on web (sign-in, account setup, save name, contact matching) | Passed | Not run |

Deploy steps, IAM gotchas and the budget alert are in [functions/README.md → Deploying to dev / prod](functions/README.md#deploying-to-dev--prod).

### Left to do

1. **Prod signing keys.** Add the SHA-1 and SHA-256 of the real release key and of the Play app signing key to the prod Android app, then run `npm run firebase:config -- prod`. Phone sign-in on prod doesn't work until then. Local release APKs are signed with the debug keystore (android/app/build.gradle), so they only work against dev.
2. **App Check.** The app doesn't include the App Check SDK yet. Add it, then set `ENFORCE_APP_CHECK=true` for the functions (see functions/README.md).
3. **Expo / EAS** (not set up yet; there is no `eas.json`):
   - Run `npx eas-cli init`. It adds `extra.eas.projectId`; push registration is skipped until this exists.
   - Upload FCM v1 credentials for Android push and let EAS manage the APNs key for iOS.
   - EAS builds can't see `firebase-config/` because it's git-ignored. Provide the files to EAS, for example as EAS file environment variables, and have app.config.ts read them from there.
4. **Builds for testers**:
   - Android APK: `npx eas-cli build -p android --profile preview` (once EAS is set up), or build locally (see [Android build](#android-build)).
   - iOS: `npx eas-cli build -p ios`, then `npx eas-cli submit -p ios` to TestFlight (needs your Apple Developer account).
5. **Before wider release**: review the privacy policy screen. Google Books lookups currently run without an API key.

## Android build

This uses Continuous Native Generation: `android/` is generated by `expo prebuild` and isn't committed. The commands below are for Git Bash on Windows, run from the repo root. Run `npm run firebase:config` first.

**Windows long-path workaround.** The SDK's default CMake 3.22.1 ships ninja 1.10, which fails on react-native-reanimated's long object paths. Use a newer CMake/ninja; Visual Studio's works:

```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
VSCM="/c/Program Files/Microsoft Visual Studio/18/Community/Common7/IDE/CommonExtensions/Microsoft/CMake"
export PATH="$VSCM/Ninja:$PATH"
```

After every `prebuild --clean`, point Gradle at that CMake:

```bash
echo 'cmake.dir=C:/Program Files/Microsoft Visual Studio/18/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake' > android/local.properties
```

(Not verified: installing CMake 3.31.x from Android Studio's SDK Manager and pointing `cmake.dir` at it should also work.)

**Release APK for a physical phone (ARM).** The app talks to `lendshelf-dev` (or `lendshelf-prod`) over the internet. Sign-in sends a real SMS; on dev you can use the test numbers instead (see [Run it locally](#run-it-locally)).

Prebuild copies `firebase-config/<env>/google-services.json` into `android/app`, so run prebuild again whenever you switch environment (add `--clean` for a fresh `android/`, then rewrite `android/local.properties`). Keep `APP_ENV` set for the Gradle build too, because it bundles the JS.

```bash
export APP_ENV=dev   # or prod
npx expo prebuild --platform android
# Windows: the JDK fails with "Unable to establish loopback connection" under the 8.3 temp path
mkdir -p android/.jtmp && export JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$(cygpath -w "$PWD/android/.jtmp")"
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a && ./gradlew --stop)
adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk
```

Notes:

- A cold build takes 30+ minutes on a busy machine; incremental builds are around 15 minutes.
- Use `-PreactNativeArchitectures=arm64-v8a` for real phones (`x86_64` for an Android emulator virtual device).
- Local release APKs are signed with the standard React Native debug keystore. Its SHA-1 / SHA-256 are registered on dev only, so phone sign-in works on dev but not on prod. Prod needs the fingerprints of the real release key or the Play app signing key (see [Going live](#going-live)).
