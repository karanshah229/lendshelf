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

## Environments

`APP_ENV` picks the Firebase project when the app is bundled or prebuilt (app.config.ts).

| Env | Firebase project | Selected when | App config comes from | Run / build |
|---|---|---|---|---|
| `emulator` | `demo-lendshelf` (local Emulator Suite) | `EXPO_PUBLIC_USE_EMULATORS=1` | Placeholder `google-services.json` and `GoogleService-Info.plist` in the repo root; demo web values in `src/lib/firebase/config.ts` | `npm run dev:web`; Android: [Android build](#android-build) |
| `dev` | `lendshelf-dev` | `APP_ENV=dev`, or neither variable set | `firebase-config/dev/` | `npm run dev:web:real`; Android: [Physical phone, dev or prod](#android-build) |
| `prod` | `lendshelf-prod` | Only `APP_ENV=prod` (never implicit) | `firebase-config/prod/` | `APP_ENV=prod` builds; phone sign-in doesn't work yet (see [Going live](#going-live)) |

`firebase-config/` is git-ignored. Download the real app configs with the Firebase CLI from `functions/`:

```powershell
npm --prefix functions install
npm --prefix functions run firebase -- login
npm run firebase:config
```

`npm run firebase:config -- dev` fetches one environment only.

Notes:

- `npm start`, `npm run web` and `npm run android` with no variables now build against `dev`, so they need `firebase-config/dev/`.
- app.config.ts stops with an error if the config files are missing, or if `APP_ENV=dev|prod` is combined with `EXPO_PUBLIC_USE_EMULATORS=1`.
- Dev has test numbers +91 90000 00001 to 05 that don't send SMS. Their code is in `firebase-config/TEST-NUMBERS.md` (git-ignored) or the Firebase console (Authentication → Sign-in method → Phone).

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
| `scripts/` | `firebase-config.mjs` (`npm run firebase:config`) |
| `firebase-config/<env>/` | Real app configs for `dev` and `prod` (git-ignored, downloaded) |
| `google-services.json`, `GoogleService-Info.plist` | Placeholder configs for the `emulator` env |
| `docs/ux/` | UX v1.1 flows, review, QA run and screenshots |

## Going live

### Done

| Item | `lendshelf-dev` | `lendshelf-prod` |
|---|---|---|
| Firestore in `asia-south1`, rules and indexes deployed | Yes | Yes |
| Phone auth on, SMS limited to India (IN) | Yes | Yes |
| Android, iOS and web apps registered (`com.lendshelf.app`) | Yes | Yes |
| Test phone numbers (+91 90000 00001 to 05) | Yes | No |
| SHA-1 / SHA-256 of the signing key | Standard React Native debug keystore | Not yet |
| Plan | Spark | Spark |

### Left to do

1. **Upgrade both projects to Blaze.** The owner has to do this (it needs a payment method) and should set a budget alert. Cloud Functions, the Storage bucket and the scheduled jobs all need Blaze. Until then, anything that calls a function fails on dev and prod, including finishing onboarding.
2. **Deploy the backend** (functions, Storage bucket and rules): see [functions/README.md → Deploying to dev / prod](functions/README.md#deploying-to-dev--prod).
3. **Prod signing keys.** Add the SHA-1 and SHA-256 of the real release key and of the Play app signing key to the prod Android app, then run `npm run firebase:config -- prod`. Phone sign-in on prod doesn't work until then. Local release APKs are signed with the debug keystore (android/app/build.gradle), so they only work against dev.
4. **App Check.** The app doesn't include the App Check SDK yet. Add it, then set `ENFORCE_APP_CHECK=true` for the functions (see functions/README.md).
5. **Expo / EAS** (not set up yet; there is no `eas.json`):
   - Run `npx eas-cli init`. It adds `extra.eas.projectId`; push registration is skipped until this exists.
   - Upload FCM v1 credentials for Android push and let EAS manage the APNs key for iOS.
   - EAS builds can't see `firebase-config/` because it's git-ignored. Provide the files to EAS, for example as EAS file environment variables, and have app.config.ts read them from there.
6. **Builds for testers**:
   - Android APK: `npx eas-cli build -p android --profile preview` (once EAS is set up), or build locally (see [Android build](#android-build)).
   - iOS: `npx eas-cli build -p ios`, then `npx eas-cli submit -p ios` to TestFlight (needs your Apple Developer account).
7. **Before wider release**: review the privacy policy screen. Google Books lookups currently run without an API key.

## Android build

This uses Continuous Native Generation: `android/` is generated by `expo prebuild` and isn't committed. The commands below are for Git Bash on Windows, run from the repo root. Emulator-mode builds also need the Firebase emulators running.

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

**Debug build (dev client + Metro):**

```bash
EXPO_PUBLIC_USE_EMULATORS=1 npx expo prebuild --platform android --clean
# write android/local.properties as above
(cd android && EXPO_PUBLIC_USE_EMULATORS=1 ./gradlew assembleDebug -PreactNativeArchitectures=x86_64)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start --dev-client --port 8082
adb reverse tcp:8082 tcp:8082
adb shell am start -a android.intent.action.VIEW -d "lendshelf://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082" com.lendshelf.app
```

**Emulator demo APK (JS bundled, no Metro needed):**

```bash
EXPO_PUBLIC_USE_EMULATORS=1 EXPO_PUBLIC_EMULATOR_HOST=10.0.2.2 npx expo prebuild --platform android --clean
# write android/local.properties as above
(cd android && EXPO_PUBLIC_USE_EMULATORS=1 EXPO_PUBLIC_EMULATOR_HOST=10.0.2.2 ./gradlew assembleRelease -PreactNativeArchitectures=x86_64)
mkdir -p dist-apk && cp android/app/build/outputs/apk/release/app-release.apk dist-apk/lendshelf-emulator-demo.apk
adb install -r dist-apk/lendshelf-emulator-demo.apk
```

**Physical phone over USB (emulator mode, ARM):** the phone reaches the emulators through `adb reverse`, so no Wi-Fi or firewall changes are needed. `firebase.json` sets `react-native.android_bypass_emulator_url_remap` so React Native Firebase doesn't rewrite `127.0.0.1` to `10.0.2.2`.

```bash
export EXPO_PUBLIC_USE_EMULATORS=1 EXPO_PUBLIC_EMULATOR_HOST=127.0.0.1
# Windows: the JDK fails with "Unable to establish loopback connection" under the 8.3 temp path
mkdir -p android/.jtmp && export JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$(cygpath -w "$PWD/android/.jtmp")"
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a && ./gradlew --stop)
for p in 9099 8080 5001 9199; do adb -s <serial> reverse tcp:$p tcp:$p; done   # again after every reconnect
adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk
```

**Physical phone, dev or prod (real Firebase, ARM):** the app talks to `lendshelf-dev` (or `lendshelf-prod`) over the internet, so no emulators and no `adb reverse`. Sign-in sends a real SMS; on dev you can use the test numbers instead (see [Environments](#environments)). Run `npm run firebase:config` first.

Prebuild copies `google-services.json` into `android/app`, so run prebuild again whenever you switch environment (add `--clean` for a fresh `android/`, then rewrite `android/local.properties`). Keep `APP_ENV` set for the Gradle build too, because it bundles the JS.

```bash
unset EXPO_PUBLIC_USE_EMULATORS EXPO_PUBLIC_EMULATOR_HOST
export APP_ENV=dev   # or prod
npx expo prebuild --platform android
# Windows: same loopback fix as above
mkdir -p android/.jtmp && export JAVA_TOOL_OPTIONS="-Djdk.net.unixdomain.tmpdir=$(cygpath -w "$PWD/android/.jtmp")"
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a && ./gradlew --stop)
adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk
```

Notes:

- A cold build takes 30+ minutes on a busy machine; incremental builds are around 15 minutes.
- Use `-PreactNativeArchitectures=x86_64` for the Android emulator and `arm64-v8a` for real phones.
- Android 17 (API 37) blocks apps from reaching private IPs like `10.0.2.2` without the "nearby devices" (`ACCESS_LOCAL_NETWORK`) permission. Emulator builds ask for it when you request a code; tap **Allow**.
- An emulator build can't talk to real Firebase, and a real build can't talk to the emulators.
- Local release APKs are signed with the React Native debug keystore. Its SHA fingerprints are registered on dev only, so phone sign-in works on dev but not on prod.
- On dev and prod, anything that calls a Cloud Function fails until the projects are on Blaze and the functions are deployed (see [Going live](#going-live)).
