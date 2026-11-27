# LendShelf

A private lending library for friends and family. Everyone lists the books they own; anyone who has your number saved in their phone can see your shared books, ask to borrow them, and read reviews. WhatsApp is where people talk — LendShelf is the system of record.

- **Start here, how it all works:** [docs/overview/](docs/overview/README.md) (user flows, core logic, architecture, decisions, feature and test maps) and the [illustrated user guide](docs/user-guide/USER-GUIDE.md)
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
3. **Expo / EAS and push.** `eas.json` is in place, but there is no EAS project or push credential yet. Follow [Push notifications setup](#push-notifications-setup).
4. **Builds for testers**:
   - Android APK: `npx eas-cli build -p android --profile dev` (once EAS is set up), or build locally (see [Android build](#android-build)).
   - iOS: `npx eas-cli build -p ios`, then `npx eas-cli submit -p ios` to TestFlight (needs your Apple Developer account).
5. **Before wider release**: review the privacy policy screen. Google Books lookups currently run without an API key.

## Push notifications setup

Pushes go through the Expo push service. Expo hands them to FCM on Android and APNs on iOS. The backend sends them from Cloud Functions (`functions/src/lib/push.ts`). The app registers its Expo push token with `registerPushToken` (`src/lib/push.ts`).

**Layout.** There is one EAS project, `lendshelf`, with two app variants:

| EAS build profile | `APP_ENV` | App id (Android and iOS) | Firebase project | Output |
|---|---|---|---|---|
| `development` | `dev` | `com.lendshelf.app.dev` | `lendshelf-dev` | Dev client APK / iOS internal build |
| `dev` | `dev` | `com.lendshelf.app.dev` | `lendshelf-dev` | APK, internal distribution |
| `prod` | `prod` | `com.lendshelf.app` | `lendshelf-prod` | AAB for Play, iOS store build |

Why:

- EAS stores push credentials per app id. A separate dev id lets each id carry the FCM key of its own Firebase project.
- Both variants share one EAS project id, so all Expo push tokens belong to one project.
- The dev build installs next to the store app, and the two signing keys never clash.
- Local builds are unchanged. They keep `com.lendshelf.app` unless you set `APP_ID=com.lendshelf.app.dev`.

**Firebase config files on EAS.** `firebase-config/` is git-ignored, so EAS never sees it. app.config.ts first reads the path in `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICE_INFO_PLIST` and `FIREBASE_WEB_JSON`. If a variable is unset or its file doesn't exist, it falls back to `firebase-config/<env>/`. On EAS these are "file" environment variables. Native builds on EAS don't need `web.json`.

### Owner steps

You need an Expo account. iOS also needs a paid Apple Developer account. Keep every key file outside the repo, and delete it once it's uploaded.

1. Log in to EAS: `npx eas-cli login`.
2. Create the EAS project: `npx eas-cli init`. It can't edit the dynamic app.config.ts, so it prints the project id. Paste that id into `EAS_PROJECT_ID_DEFAULT` in app.config.ts and commit it. The id isn't a secret. `EAS_PROJECT_ID`, `EAS_PROJECT_ID_DEV` or `EAS_PROJECT_ID_PROD` still override it if set.
3. Register the dev variant in Firebase. In the `lendshelf-dev` console, add an Android app and an iOS app, both with the id `com.lendshelf.app.dev`. Download the new `google-services.json` and `GoogleService-Info.plist` for these apps. For local builds of this variant, also add the debug keystore's SHA-1 and SHA-256 to the new Android app. (`npm run firebase:config` takes the first app it finds, so it may fetch the other app's `.plist`.)
4. Upload the Firebase config files to EAS. On expo.dev, open the project, then **Environment variables** → **Add variables**. Use type **File** and visibility **Secret**:
   - `GOOGLE_SERVICES_JSON`: the dev file for `development` and `preview`; `firebase-config/prod/google-services.json` for `production`.
   - `GOOGLE_SERVICE_INFO_PLIST`: the same split, with the `.plist` files.
   - The CLI can do this too (`npx eas-cli env:create --help` lists the file option).
5. Check that FCM V1 is on. In each Firebase project, open **Project settings** → **Cloud Messaging**. "Firebase Cloud Messaging API (V1)" must say Enabled.
6. Create an FCM V1 key for `lendshelf-dev`. Open **Project settings** → **Service accounts** → **Generate new private key**.
7. Upload it for the dev app id. Run `npx eas-cli credentials -p android`. Pick the `dev` profile, then **Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)** → **Set up** → **Upload a new service account key**.
8. Repeat steps 6 and 7 for `lendshelf-prod`, with the `prod` profile (`com.lendshelf.app`).
9. iOS only: register your test devices with `npx eas-cli device:create`. On the first iOS build, answer yes to "Setup Push Notifications" and to generating a new APNs key. One APNs key serves both bundle ids. You can also do this later from `npx eas-cli credentials -p ios`.
10. Add the EAS signing fingerprints to Firebase, or phone sign-in fails. `npx eas-cli credentials -p android` shows the SHA-1 and SHA-256 per app id. Add them to the matching Android app in Firebase. For prod, also add the Play app signing key later.
11. Optional, recommended before prod: turn on enhanced push security.
    1. On expo.dev, create an access token (**Account settings** → **Access tokens**).
    2. Store it for each project: `npm --prefix functions run firebase -- functions:secrets:set EXPO_ACCESS_TOKEN --project dev` (then `--project prod`).
    3. Set `USE_EXPO_ACCESS_TOKEN=true` in `functions/.env.dev` and `functions/.env.prod`, then deploy the functions.
    4. Only then switch on **Enhanced security for push notifications** on expo.dev. Sends without the token fail from that moment.
    5. Don't set `USE_EXPO_ACCESS_TOKEN=true` before the secret exists: the deploy fails.
12. Build: `npx eas-cli build -p android --profile dev`. Install the APK from the link or QR code. The store build is `npx eas-cli build --profile prod`.

### Testing a push end to end (dev)

1. Install the `dev` build on a real phone. Sign in with a dev test number.
2. Allow notifications (the pre-prompt, or **Me** › **Notifications**).
3. In the `lendshelf-dev` Firestore console, open `users/{uid}`. `pushTokens` should hold an `ExponentPushToken[...]`. If it's empty, check the device log for "No EAS projectId".
4. Send a test push from https://expo.dev/notifications to that token. It should arrive.
5. Now test the backend. Run `npm run dev:web` and sign in with a second test number. Save the phone user's number and ask to borrow one of their books. The phone should show "Borrow request".
6. If nothing arrives, read the function logs: `npm --prefix functions run firebase -- functions:log --project dev`. "Expo push ticket errors" with `InvalidCredentials` means the FCM key (step 7) or the APNs key (step 9) is missing.

### Costs

- The Expo push service is free.
- EAS Build's free plan has a small monthly build quota in a low-priority queue. Paid plans add builds. See expo.dev/pricing.
- iOS needs the Apple Developer Program (yearly fee). Play needs a one-off developer fee.
- The access-token secret costs cents at most in Secret Manager.
- Free alternatives to EAS Build:
  - Build locally with Gradle (see [Android build](#android-build)). Pushes still work, because the credentials live in the EAS project, not the build. For the dev variant, set `APP_ID=com.lendshelf.app.dev` and put the dev app's `google-services.json` in `firebase-config/dev/`.
  - `npx eas-cli build --local` runs the EAS build on your own machine. It needs macOS or Linux; on Windows, use WSL.

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
