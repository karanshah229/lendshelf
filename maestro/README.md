# Maestro UI tests

End-to-end flows that drive the real Android app on a phone over ADB, against the `lendshelf-dev` project. They complement the Jest and Vitest suites (see [docs/overview/TEST-MAP.md](../docs/overview/TEST-MAP.md)), which never render a screen.

| Flow | File | Checks | Test user |
|---|---|---|---|
| Reading | [flows/reading.yaml](flows/reading.yaml) | Book page: I’m reading this, Finished it (review screen opens, leave without posting), Read it again, Stop reading; Me › Reading lists the book; the share switch flips both ways | Ravi |
| Wishlist Ask button | [flows/wishlist-ask-button.yaml](flows/wishlist-ask-button.yaml) | Home › From your wishlist: title and “Available from Asha” are on screen and Ask sits to their right | Ravi |
| Long confirm label | [flows/long-confirm-label.yaml](flows/long-confirm-label.yaml) | Loans › Got it back: “Yes, it’s back” is shown in full and fills its button | Ravi |
| Sign out and back in | [flows/sign-out-and-in.yaml](flows/sign-out-and-in.yaml) | Me › Sign out, then phone number and code bring back the same account | Ravi |

Shared steps live in [subflows/](subflows): `as-user.yaml` (open the app as a given test user, switching accounts if needed), `sign-in.yaml`, `sign-out.yaml` and `open-book.yaml` (Home search → Book page).

## Dev data the flows rely on, and leave alone

The flows use the existing dev accounts and undo what they change:

- **Reading** needs Ravi not to have marked Asha’s *Atomic Habits*. It ends with Remove from Read, and the share switch ends where it started. It never posts a review.
- **Wishlist Ask button** needs Asha’s *Atomic Habits* to be available. It adds the book to Ravi’s wishlist only if it isn’t there, and removes it again.
- **Long confirm label** needs a book Ravi has lent out (today: *Animal Farm* with Asha). It opens the confirm and taps Cancel.
- **Sign out and back in** leaves Ravi signed in, as every flow does.

If a run stops half-way (phone locked, app crash), *Atomic Habits* can be left marked as read or on Ravi’s wishlist. Open it as Ravi and tap Remove from Read or On wishlist before the next run. Reading stops at its first check rather than overwrite a state it didn’t create; Wishlist Ask button would pass but then leave the book on the wishlist.

## 1. Install the Maestro CLI on Windows

Maestro needs Java 17 or newer (`java -version`) and ADB (Android SDK platform-tools).

1. Download `maestro.zip` from the [Maestro releases](https://github.com/mobile-dev-inc/maestro/releases) (CLI 2.12.1 was used here) and check it against `checksums_sha256.txt` from the same release.
2. Unzip it so that the launcher ends up at `%USERPROFILE%\.maestro\bin\maestro.bat` (the zip holds a `maestro` folder with `bin` and `lib`; copy those two into `%USERPROFILE%\.maestro`).
3. Optional: add `%USERPROFILE%\.maestro\bin` to `PATH`. `npm run e2e` finds it there either way; set `MAESTRO_BIN` to use another location.

```powershell
& "$env:USERPROFILE\.maestro\bin\maestro.bat" --version
```

`npm run e2e` turns off Maestro’s usage analytics for its runs (`MAESTRO_CLI_NO_ANALYTICS=1`).

## 2. Build and install the release APK

Follow [docs/overview/ARCHITECTURE.md §5.4](../docs/overview/ARCHITECTURE.md) for the Windows build environment (`ANDROID_HOME`, Visual Studio’s CMake and Ninja in `android/local.properties`, `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=...`). Then, from the repo root with `APP_ENV` unset or `dev`, generate `android/` if it is missing or out of date (re-point `cmake.dir` afterwards, as §5.4 says):

```powershell
npx expo prebuild --platform android
```

```powershell
cd android; ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a; cd ..
```

```powershell
adb -s 32231JEGR12038 install -r android/app/build/outputs/apk/release/app-release.apk
```

The APK is `com.lendshelf.app`, signed with the debug keystore, so it signs in on dev only. A cold build takes 30+ minutes; skip it when the installed app already matches the code you want to test.

## 3. Run the flows

Connect the phone over USB with USB debugging on, unlock it and keep the screen on. Check it shows up:

```powershell
adb devices -l
```

Run every flow (the order is set in [flows/config.yaml](flows/config.yaml)):

```powershell
npm run e2e -- --device 32231JEGR12038
```

Run one flow:

```powershell
npm run e2e -- --device 32231JEGR12038 maestro/flows/reading.yaml
```

`--device` is needed when ADB lists the phone twice (USB and wireless debugging) or more than one phone is attached; without it Maestro uses `ANDROID_SERIAL` or asks.

### Sign-in codes

The flows sign in with the dev test numbers +91 90000 00001 to 05 (Asha, Ravi, Meera, Kabir, Zoya). Their codes are never written into the flows or these docs. `npm run e2e` reads them from the environment (`CODE_1` … `CODE_5`) or, if those aren’t set, from the git-ignored `firebase-config/TEST-NUMBERS.md`, and passes them to Maestro as `-e CODE_n=…` without printing them. Calling Maestro yourself works the same way:

```powershell
maestro --device 32231JEGR12038 test -e CODE_1=… -e CODE_2=… -e CODE_3=… -e CODE_4=… -e CODE_5=… maestro/flows
```

The code is typed with a `label`, so Maestro’s console output doesn’t show it. Maestro’s own debug folder (`%USERPROFILE%\.maestro\tests\<run>`) does record it in its logs; that folder is local to your machine and outside the repo. Delete old runs there if that matters.

### When a flow fails

Maestro prints the failing step and the debug folder, which has a screenshot and the screen’s UI tree. `maestro --device 32231JEGR12038 hierarchy` dumps the live UI tree; `maestro studio` opens an interactive picker in the browser.

## Writing flows

- Select by visible text or screen-reader label (`accessibilityLabel`); the app has no `testID`s. Text selectors are regular expressions that must match the whole text, so escape `?`, `(` and `+`, or match around them with `.*`.
- The app uses curly apostrophes (`’`): write `I’m reading this`, not `I'm`.
- Never tap Allow on a system prompt, Message on WhatsApp, or a confirm that changes data you don’t undo in the same flow.
- Start each flow with `subflows/as-user.yaml` and end it with dev data as it was.
