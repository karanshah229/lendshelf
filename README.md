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

This uses Continuous Native Generation: `android/` is generated by `expo prebuild` and isn't committed. The commands below are for Git Bash on Windows, run from the repo root, with the Firebase emulators running.

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

Notes:

- A cold build takes 30+ minutes on a busy machine; incremental builds are around 15 minutes.
- Drop `-PreactNativeArchitectures=x86_64` to build for real phones (ARM), which hasn't been tested yet.
- Android 17 (API 37) blocks apps from reaching private IPs like `10.0.2.2` without the "nearby devices" (`ACCESS_LOCAL_NETWORK`) permission. Emulator builds ask for it when you request a code; tap **Allow**.
- An emulator build can't talk to real Firebase, and a real build can't talk to the emulators. For phones, build without the `EXPO_PUBLIC_USE_EMULATORS` variables after setting up a real Firebase project.
