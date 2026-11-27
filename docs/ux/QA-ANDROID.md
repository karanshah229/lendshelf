# LendShelf: Android device QA (dev project)

Tested 21 Nov 2026 on a physical Android 16 phone (1080 × 2392, dark mode) with the installed dev build (`com.lendshelf.app` 0.1.0) talking to the real `lendshelf-dev` Firebase project. Asha (test number 01) used the phone. Ravi (02), Meera (03) and a throwaway user (04) used the web build (`APP_ENV=dev`, port 8083) at the 375 × 812 preset. Spec: `docs/ux/UX-FLOWS.md` §E, §F. Earlier web QA: `docs/ux/QA-V1.1.md`.

Screenshots are kept outside the repo (the status bar shows personal notifications); only their filenames are listed here.

## Verdict

Most loan flows work end to end on the device against real Firebase. The backend states (accept, decline with reason, hide and decline, not back yet, not collected, got it back, owner-left pre-check, delete account), the Loan screen, deep links, the B1 contacts guard and the Storage cover upload all behaved correctly.

Four major problems should be fixed before a wider device rollout:

1. Push notifications can never be turned on from inside the app on Android 13+.
2. Destructive confirm buttons ("Cancel request") ignore taps on their label on Android.
3. Android Back in Add books throws away the scan queue and the confirm step without asking.
4. Short names are the first word of the saved contact name, so two friends saved as "LendShelf Test Ravi" and "LendShelf Test Meera" both show as "LendShelf" everywhere, including the Person-page WhatsApp greeting.

The keyboard no longer covers Send code (fixed, `55-send-code-keyboard.png`).

## Coverage

| Flow | Result | Notes |
|---|---|---|
| E1 sign-up / sign-in | Pass | Web sign-up for 02, 03, 04. Phone sign-out and sign-in again as Asha; Send code sits above the keyboard. Sending the code took about 45 s on the phone. A returning user goes straight to Home. |
| E2 / E2a cold start, invite | Pass | 0-match screen and Home empty state match E2a(i). Invite opens the system share sheet with the prefilled text (no link yet, H1). |
| Contacts sync, one-way matching | Pass | After adding the two test contacts, Sync now found 2 people. Ravi's and Meera's private collection books stay hidden. Kabir (not in Asha's contacts) shows "Not in your contacts · +91 …" on his request card. |
| B1 guard (Sync now after contacts removed) | Pass | "Your contacts look incomplete · Keep everyone / Remove 2 people"; Me then reads "Some contacts weren't checked" (`50-sync-guard.png`). |
| E3 search / who has it | Pass | Circle hits, "You own / With you", catalogue fallback with wishlist heart. First catalogue search on the phone took about 25–30 s. |
| E4 ask → accept → pick-up window | Pass | Ask sheet, WhatsApp auto-opens with "Hi Ravi!", persistent "Request sent", pick-up card and Loan screen. |
| Cancel request | Partly | Works, but the confirm button ignores taps on its centre (Bug 2). |
| E5 accept with pickup prompt | Pass | Pickup field shown while the note is empty; text lands in the WhatsApp message. Keyboard hides the Lend button (Bug 5). |
| E5 decline with reasons | Pass | "Not lending this one" + "Also stop lending" (copy became Not lending); "I'm reading it" from web; borrower's Recent shows the reason text. |
| E6 I've returned it → Not back yet → returned → Got it back | Pass | Live on both sides; "hasn't got it back yet" card on the phone. Only possible on a recorded loan, because a requested loan blocks "I've returned it" for 48 h (Bug 6). |
| Not collected | Pass | Owner closed Atomic Habits as not collected; copy available again. |
| Due-date change | Pass | Earliest date is today; timeline shows "Due date moved"; borrower card "due tomorrow". |
| Overdue / Nudge | Not tested | Needs a past due date; writing test data to Firestore was not permitted. |
| E7 lend to app user / non-app person | Pass | Phone: lent a private copy to Ravi, then Got it back with the confirm sheet. Web: lent to "Nikhil (neighbour)" with a number and to a person with no number. |
| E8 add by search / by hand / ISBN | Pass | Search, hand entry with a cover photo, ISBN typed into the scan field. |
| E8 scanner | Partly | Camera denied → "Camera access is turned off… Open Settings" works. The live scanner was not started (camera stayed denied, see end state). |
| Cover upload to Storage | Pass | About 19 s for upload + add; `coverUrl` is a `firebasestorage` URL and Meera sees the cover on web (`12-mybooks-3.png`). |
| E9 shelves, private collection, hide with request | Pass | Private collection hides copies from contacts; "Hiding … declines Asha's request" declined first; borrower page then shows a generic "Copy not found" (Bug 7). |
| Home Needs you, status strip, Loans order, badge | Pass | 2 cards + "See all 3 in Loans", badge counts cards, Back at Loans returns to Home. |
| E10 reviews | Pass | "How was it?" → review with the tapped rating; inline "Your review" afterwards. |
| E11 wishlist, notify when back | Pass | Meera's wishlist match appeared on Home; back-watch toggle works. Pushes not observable (Bug 1). |
| E12 push permission and delivery | Fail | No pre-prompt ever appears; Me row opens Settings (Bug 1). |
| E13 auto re-sync on foreground | Not tested | Only runs when the last sync is over 24 h old. |
| Contacts denied → Retry | Not tested | `pm grant`/`pm revoke` are blocked on this phone, so READ_CONTACTS was left untouched. |
| E14 export | Pass | CSV and JSON both open the share sheet; backed out without a target. |
| Privacy policy, edit profile | Pass | |
| E15 delete account (throwaway 04) | Pass | Pre-check listed the hand loan and the open request; profile, hand loan and back-watch removed. |
| Deep links | Pass | Cold start `lendshelf://loan/<id>` → Loan, Back → Home; warm from Me returns to Me; unknown id → "This isn't shared with you any more". |
| Android Back | Partly | Correct on tabs, detail screens, sheets and dialogs; wrong in Add books (Bug 3). |
| Keyboard over inputs | Partly | OK on sign-in, Ask, review, manual add, edit profile; covers the Accept sheet button (Bug 5). |
| Safe areas / clipping | Pass | No clipping seen at default font size. 200 % font and TalkBack not tested (phone settings). |
| Pull to refresh | Not implemented | No RefreshControl anywhere; lists update live. |
| Kill and reopen | Pass | Force-stop then launch lands on Home. |
| No network | Not tested | No app-only way to go offline. |
| Firestore permission errors | None seen | Release build logs only Bugsnag to logcat, so this check is weak. |

## Bugs (most severe first)

### 1. Major: push can never be enabled from the app on Android 13+
- Steps: send a request, accept one, or add to wishlist; then Me › Push notifications.
- Expected: one-line pre-prompt, then the system dialog (E1, C11).
- Actual: no pre-prompt at any trigger. Me shows "Notifications off… Tap to turn on" and opens App info. The OS has never asked (POST_NOTIFICATIONS has no user-set flag), so push tokens never register.
- Cause (likely): on Android 13+ `Notifications.getPermissionsAsync()` reports `denied` with `canAskAgain: true` before the first request. `src/lib/push.ts:66-69` and `:74-80` map that to `denied`; `src/features/push-ask/decision.ts:39` then returns `none`; `src/features/me/notifications-section.tsx:46-50` opens Settings. Treat `denied && canAskAgain` as undetermined.
- Screenshot: `03-me-after-sync.png`.

### 2. Major: destructive confirm buttons ignore taps on their label (Android)
- Steps: copy page with your request › Cancel request › tap "Cancel request" in the dialog.
- Expected: request cancelled.
- Actual: nothing happens on the centre (twice, reproducible); tapping the red edge works. The button draws a second, smaller red box around the label.
- Cause (likely): `src/features/loans/confirm-button.tsx:67-71` passes `buttonVariants({ variant: 'destructive' })` to `AlertDialogAction`, and `src/components/ui/alert-dialog.tsx:122` also feeds that className into `buttonTextVariants`, so the inner Text gets button classes (including `active:`) and takes the touch. Web is unaffected because button text is `pointer-events-none` there (`button.tsx:67`). Same pattern: `loan-sheets.tsx:509` (cancel request and decline on the Loan screen) and `add.tsx:298` (Discard).
- Screenshots: `38-cancel-state.png`, `61-cancel-deadzone.png`.

### 3. Major: Android Back in Add books discards work
- Steps: Add › Scan › type an ISBN › Add (queue = 1) › Back. Or open Review › Back.
- Expected: "Discard 1 scanned book?" (E8); from Review, back to the queue (header back does this).
- Actual: the whole Add modal closes and the queue is lost.
- Cause: `src/app/(app)/add.tsx:174-180` (`backFromStep`) is wired only to the header button; there is no `BackHandler`/`beforeRemove`, and the queue isn't part of the "dirty" check.
- Screenshot: `08-isbn-queue-keyboard.png`.

### 4. Major: first-word short names collide and leak into WhatsApp text
- Steps: save two friends whose saved names share a first word, Sync now.
- Expected: tell them apart; WhatsApp greets by profile first name (R21).
- Actual: both shown as "LendShelf" in the People row, "LendShelf added 2 books", "Message LendShelf", "Lend to LendShelf", "Thanks. LendShelf and others can see it". "New on LendShelf: LendShelf" names only one of the two, and the setup card says "LendShelf can borrow from you". The Person page WhatsApp text was "Hi LendShelf! Saw your books…".
- Cause: `src/features/shared/people.ts:35-45` (first word), `people.ts:66` (`joinNames` de-duplicates equal short names), `src/features/discover/DiscoverHome.tsx:160,187,225` (own `split(' ')[0]`), `src/app/(app)/person/[uid].tsx:81` (greeting uses the saved name, also `:158,:173`).
- Screenshots: `04-home-circle.png`, `15-viewer-copy.png`, `22-accept-sheet.png`, `37-wa-person.png`.

### 5. Minor: keyboard hides the Accept sheet's primary button
- Steps: Accept a request while your pickup note is empty › type in "Where can they pick it up?".
- Actual: "Lend to …" sits under the keyboard; Back hides the keyboard first.
- Cause: the accept due-date sheet isn't keyboard-aware (`src/features/loans/due-date-dialog.tsx`).
- Screenshot: `23-accept-keyboard.png`.

### 6. Minor: borrower can't say "I've returned it" during the 48 h pick-up window
- Book picked up and given back within two days: only the owner can close it.
- Cause: `src/features/loans/loan-view.ts:292-304` (pickup phase has no `markReturned`).
- Screenshot: `27-loan-borrower-pickup.png`.

### 7. Minor: hidden copy shows a generic "Copy not found"
- Expected (E3): "This copy isn't shared any more" + "See other copies of this book".
- Cause: not-found branch in `src/app/(app)/copy/[itemId].tsx`.
- Screenshot: `41-hidden-copy-viewer.png`.

### 8. Minor: setup copy promises one-way friends can borrow from you
- Kabir saved Asha, Asha didn't save Kabir; Kabir's setup card says "Asha can borrow from you once you add yours".
- Cause: `src/features/home/setup-card.tsx:133,156` use the people I saved, which says nothing about who sees me.

### 9. Minor: the app also holds WRITE_CONTACTS
- Granted together with READ_CONTACTS, though the app only reads. The privacy copy says the address book is never stored; write access is still more than needed.
- Fix: `android.blockedPermissions: ['android.permission.WRITE_CONTACTS']` near the `expo-contacts` plugin in `app.config.ts:93-99`.

### 10. Minor: "Not back yet" disappears from the timeline
- After returned → not back yet → returned → confirmed, the timeline shows one "You said you returned it" and no "Not back yet".
- Cause: timeline built from single fields in `loan-view.ts` (`notBackYetAt` cleared on re-mark).
- Screenshot: `34-closed-loan-review.png`.

### 11. Polish
- Web: the request card, owner row and lend picker show the profile name ("Asha Rao") although the contact was saved as "Asha" (E13: saved name wins).
- Wishlist heart keeps the label "Add to wishlist" after it is filled (`49-wishlist-added.png`).
- Sheet close (×) buttons are about 15 dp (e.g. Ask sheet), under the 48 dp target (F8).
- With the keyboard up on Scan, the scanned list shrinks to a sliver (`08-isbn-queue-keyboard.png`).
- Web catalogue search keeps the previous query's results for a few seconds with no loading state.
- A private collection with "Lendable" selected still shows the Lendable help text ("can see it and ask") under the "only you will see this book" note.

## Real Firebase notes

| Call | Observed (client) |
|---|---|
| `resolveBook` first call (web) | about 6–10 s; later 4–6 s |
| `requestLoan` first call (phone, until WhatsApp opened) | about 12 s |
| `respondToRequest` accept (phone) | about 14–18 s |
| decline / mark returned / not collected (phone) | about 5–10 s |
| Add with cover upload (phone) | about 19 s |
| Phone sign-in "Sending code…" | about 45 s |

Function logs show "Starting new instance" cold starts (for example `synccontacts`, `recordloan`); the first call to each function is well over 3 s. No Firestore permission errors were seen.

## Not tested, and why
- Push delivery and tap routing: blocked by Bug 1, and enabling it in system Settings was out of scope.
- Contacts denied → Retry, and re-granting camera: `pm grant/revoke` need a developer setting on this phone.
- Live barcode scanner: camera stayed denied.
- Overdue, Nudge, request expiry, owner-left: need backdated data.
- Auto re-sync after 24 h, TalkBack, 200 % font, no-network: need time travel or phone settings.

## Test data left in `lendshelf-dev`
- Asha: Malgudi Days QA (custom, Storage cover, Not lending), Atomic Habits, Nineteen Eighty-Four (private collection "Asha private"), pickup note.
- Ravi: Sapiens, Animal Farm (lent to Asha, pick-up window), Piranesi (Not lending), The Martian (Hidden), Dune (private collection "Ravi private").
- Meera: The Alchemist, Project Hail Mary, a review of Atomic Habits, a wishlist entry.
- Asha's circle links to Ravi and Meera kept ("Keep everyone").
- Throwaway user 04 created and deleted.

## Re-test on Pixel 6a (2026-11-27)

Second phone: Pixel 6a, Android 17, 1080 × 2400, dark mode, dev build with the fixes from `a85e8cf`, real `lendshelf-dev`. WhatsApp is not installed on this phone, so every WhatsApp hand-off opened the browser instead (confirmed, then Back).

The web build could not be used: Ravi's web sign-in got a reCAPTCHA image challenge, which QA does not solve. Instead, Asha (01) and Ravi (02) took turns on the phone (sign out, sign in), which covered the two-person flows. The short-name and setup-card checks need hand-added web contacts and were checked only in code and unit tests. No throwaway user was created.

### Fixes

| Fix / check | Result | Notes |
|---|---|---|
| 1 Push pre-prompt | Pass | After Ask: "Get told when Ravi answers?" → Turn on notifications → OS dialog. Denied path: Don't allow, then Me › Push notifications asked the OS again (not Settings); Allow → row shows "On". Logcat: `[push] No EAS projectId … skipping push registration`, as expected. |
| 2 Red confirm buttons | Pass | Centre taps work on Cancel request, Decline (with reason), Discard (Add books), Hide and decline, Not back yet. Each dialog button is now one touch target. |
| 3 Add books Back | Pass | Back with the keyboard up hides it first. Back with a 1-item queue → "Discard 1 scanned book?" (Keep scanning / Discard). Back on Review returns to Type it in with the text kept. Back on a typed form → "Discard this book?". |
| 4 Short-name collisions | Not tested on device | Needs hand-added web contacts (web blocked). `short-names.test.ts` passes. On the phone, names showed as "Ravi", "Meera", "Asha" (profile first names, no saved names). |
| 5 Keyboard over dialogs | Pass, with a new issue | Accept sheet: "Lend to Asha" and Cancel stay above the keyboard. Ask and Edit profile are also fine. When the sheet is tall, its title and × move under the status bar (new bug A). |
| 6 Hidden copy | Pass (navigated) | After Asha hid a requested copy, Ravi opened it from the declined loan: "This copy isn't shared any more" + "See other copies of this book" → book page. The "already open when hidden" case needs two devices and was not tested. |
| 7 Timeline keeps Not back yet | Pass | New loan: asked → accepted → returned → not back yet → returned → confirmed. All six rows are shown on Ravi's loan. |
| 8 Return during pick-up window | Pass, with a new issue | "I've returned it" is next to "Not picking it up?", behind "Did you give 'Sapiens' back to Ravi?". After the owner says Not back yet, the loan goes back to "Pick up from Ravi" (new bug B). |
| 9 Setup card copy | Code only | `setupBooksLine` / `libraryWelcomeLine` now say "if they have your number saved". Not seen on a device (needs a one-way web user). |
| 10 WRITE_CONTACTS | Pass | `dumpsys package` requests only READ_CONTACTS, CAMERA and POST_NOTIFICATIONS. |

### Previously untested

| Check | Result | Notes |
|---|---|---|
| Contacts denied → Contacts are off | Pass | The first deny keeps "Find your people" with no change (Android can still ask). The second deny → "Contacts are off · Open Settings / Continue without". After `pm grant` and Open Settings → Back, the app synced by itself. |
| Camera → live scanner | Pass | "While using the app" → the viewfinder overlay and torch button appear, and the camera service shows the app holding camera 0. Backed out without scanning. |
| Android 17 | Pass | Edge-to-edge insets are right on tabs, headers and the tab bar. The app opts out of predictive back (`predictiveBackGestureEnabled: false`; logcat "OnBackInvokedCallback is not enabled"). The edge swipe and the Back key both work. |
| Kill and reopen | Pass | Force-stop, then launch: activity drawn in 0.5 s, Home with data in about 6 s. |

### New bugs

**A. Minor: dialogs lifted by the keyboard go under the status bar.** Accept sheet with the pickup field focused: the title sits on the clock, and × overlaps the status icons (`28-accept-keyboard.png`). Cause: `src/components/ui/dialog-keyboard-frame.tsx:18-21` has no top safe-area inset.

**B. Minor: after "Not back yet" in the pick-up window, the loan looks un-picked-up.** Borrower: "Pick up from Ravi" with "Not picking it up? Tell Ravi" (the not-collected action). Owner: "Waiting for Asha to pick up". This shows while the timeline says it was returned (`35-asha-notbackyet.png`). Cause: `src/features/loans/needs-you.ts:40-48` (`inPickupWindow`) only checks `startedAt`, so `loan-view.ts:131` returns `pickup`. Ignore the window once a return event exists.

**C. Minor: catalogue outage reads as "Can't reach LendShelf. Check your connection".** ISBN lookups (Scan, typed) failed for two ISBNs after 12–16 s while the phone was online. From the test PC, Open Library took about 19 s and Google Books returned 429. The server throws `unavailable` ("The book catalogue couldn't be reached", `functions/src/lib/books.ts:328-331`), but `src/lib/errors.ts:66` treats every `unavailable` as no connection. Manual add still works; its catalogue check gives up in about 4 s.

**Polish.** In onboarding on a phone whose address book yields no numbers, "Find your people" says "None of your contacts are on LendShelf yet" while Home shows 2 friends (links from another device kept). Me › Contacts then reads "not checked yet". With the keyboard up on Scan, the scanned list is hidden completely, not just shrunk.

### Timings (client, this phone, ±1 s)

| Action | 1st | Later |
|---|---|---|
| Send code (native phone auth) | 39 s | 36–39 s; 13 s and 24 s once each |
| Verify code | 5–7 s | 4–5 s |
| Ask → WhatsApp hand-off | about 7 s (Asha), 5.6 s (Ravi) | about 1 s; 3.4 s measured with logcat |
| Accept | 4.8 s | n/a |
| Cancel request | 9 s | 10 s |
| Decline / mark returned / not back yet / hide and decline | 4–5 s | 4–5 s |
| Add by hand: catalogue check + add | 4.5 s + 4 s | 4.5 s + 4 s |
| ISBN lookup | fails at 12–16 s | same (catalogue down) |

### App Check
- The app has no App Check provider. Every callable logs `FirebaseContextProvider: Error getting App Check token … No AppCheckProvider installed` about 0.4 s after the tap and sends a placeholder token. Firebase Auth logs the same (`LocalRequestInterceptor`).
- Server logs from 21 Nov show the result: "Decoding App Check token failed", then "Allowing request … because enforcement is disabled". `functions:log` returned nothing newer.
- The failed token fetch is fast, so it is not where the seconds go. In a marked Ask, the tap was at 0 s, the App Check warning at 0.4 s and WhatsApp at 3.5 s, so about 3 s is the callable round trip.
- Cancel staying at about 10 s looks like a cold instance.
- Sign-in's 36–39 s passes before the Auth request leaves the app (no app log lines in between), which points at Firebase Auth's app verification (Play Integrity / reCAPTCHA), not App Check.

### Sign-in speed
- Send code is 2.2–3.5 s on the Pixel, both warm and after a cold start, measured with logcat and timed screenshots. Verify is about 1.3 s.
- The steps are: `getRecaptchaConfig` (about 0.4 s; "No Recaptcha Enterprise siteKey" is expected and harmless), then a Play Integrity token (1.0–1.5 s), then `sendVerificationCode` (about 0.4 s). No reCAPTCHA browser opened.
- The 36–39 s above is a measurement artefact. The code screen's 1 s resend countdown keeps the UI busy, so `uiautomator dump` fails ("could not get idle state", about 11 s per try) until the countdown ends.
- Time screens with `screencap` or logcat, not `uiautomator dump`.
- After 4 s, the Send code button now reads "Checking this phone…", so a slow network doesn't look broken.

### End state
- Pixel signed in as Asha on Home.
- Permissions: READ_CONTACTS granted (flagged user-fixed after the deny test), CAMERA granted while in use, POST_NOTIFICATIONS granted.
- Web server stopped, viewport reset, no throwaway users.

### New test data in `lendshelf-dev`
- Asha: "QA Retest Pixel" (Lendable) and "QA Retest Pixel Two" (Hidden), both by Test Author.
- Ravi: a returned Sapiens loan to Asha with the full timeline, and pickup note "QAdesk" (if the accept sheet saved it).
- Declined and cancelled requests in both users' Recent lists.

## Time-based flows on dev (2026-11-27)

Tested on `lendshelf-dev` with the web build (`APP_ENV=dev`, port 8085, 375 × 812), signed in as Asha and Ravi. Two fresh loans were made through the app (Asha asked for Ravi's Sapiens and Ravi accepted; Ravi asked for Asha's QA Retest Pixel). Their `requestedAt`, `startedAt` and `dueDate` were then backdated with the Firestore REST API, and `dailyMaintenance` was run on demand through its Cloud Scheduler job. Push delivery can't be checked (no EAS project), so reminders were checked in the function logs ("Push skipped: no tokens" with the recipient and title) and in Firestore. The job has no per-day marker; which reminder goes out depends only on the time from now to `dueDate`.

| Flow | Result | Notes |
|---|---|---|
| Request expiry after 7 days | Pass | `requestedAt` 6 days ago: borrower's Needs-you card "Your request to Asha Rao expires tomorrow"; Loan "expires tomorrow". 7 days 1 h ago: the app already shows "Your request expired · Ask again" before the job runs. Job: `expired: 1`, status `expired`, push "Request expired" to the borrower. Owner's Loan: "Request expired · You didn't answer Ravi's request in 7 days" with **Message Ravi** and no Accept. Both Recent lists show it. |
| Due-tomorrow reminder | Pass, with bug D | Due in 30 h: `dueSoon: 1`, push "Due soon" to the borrower only. Borrower's Home and Loans: card "due tomorrow" with I've returned it / Ask for more time. The push body isn't logged; the "tomorrow" wording is covered by unit tests. |
| Overdue, first reminder | Pass, with bug D | Due yesterday at noon IST: `overdue: 1`, "Overdue" to owner and borrower. Owner's Home: overdue card "Sapiens with Asha Rao · N days overdue" with **Nudge on WhatsApp**, Got it back and change-date icon; strip "2 out with friends, 1 overdue"; Loans tab badge. Borrower: "1 day overdue" card, oldest deadline first. |
| Weekly overdue reminder | Pass | Due 7 days 2 h ago: `overdue: 1` to both. Due 3 days ago (control): `overdue: 0`, while the app still says "3 days overdue". |
| Nudge on WhatsApp | Pass | `wa.me/<borrower number>` with "Hi Asha! Just a reminder that "Sapiens" was due back on 20 Nov. Could you return it when you get a chance?". The borrower's Ask for more time: "Hi Ravi! Could I keep "Sapiens" a little longer? Maybe till 4 Dec?". The browser pane blocks popups, so the URL was captured in the page and nothing was opened or sent. |
| End of the 48 h pick-up window | Pass | `startedAt` 2 min short of 48 h: owner Loan "Waiting for Asha to pick up", Message Asha, Not collected. It switched to "With Asha · Due 18 Dec" with Got it back and Nudge Asha without a reload (about 1 min tick). Borrower at 47 h: card "Ravi said yes to Sapiens · Pick up from Ravi · pickup: QAdesk", With you "Pick up from Ravi"; at 49 h the normal due wording. |

### Bug D (fixed on dev): date-only due dates are reminded a day early

**Major.** Accept and Change due date send a date-only value ("2026-12-18", `src/features/loans/due-dates.ts:86-88`). `resolveDueDate` (`functions/src/lib/loans.ts:130-143` before the fix) parsed it as UTC midnight, 05:30 IST on the due day. The 09:00 IST job (`reminderKind`, `functions/src/lib/loans.ts:160-168`) then:
- sends "Overdue" to owner and borrower on the due day itself, while the app says "due today". Reproduced: due `2026-11-27T00:00Z` → `overdue: 1`, Loans row "due today";
- sends "Due soon" two days early ("in 2 days") and nothing the day before.

The Lend screen sends local noon (`src/features/lend/due-date.ts:72-74`), so recorded loans were fine.

Fix: a date-only value now means noon IST on that day, and the past-date check compares calendar days in India. Unit tests were added for the reminder days of a date-only due date; `npm --prefix functions test` passes. `respondToRequest`, `recordLoan` and `updateDueDate` were deployed to dev from a clean checkout of HEAD plus this change. Change due date on dev then stored `2026-12-25T06:30Z`.

Loans saved before the fix keep their 05:30 due times. Animal Farm (due 28 Nov) will get its "Overdue" pushes at 09:00 on 28 Nov. Prod data was not checked or migrated.

### Polish
- Between day 7 and the next job run, an expired request appears twice on the borrower's Loans: as a Needs-you card "Your request to Asha Rao expired" and as a "Your requests" row reading "expired".
- Backdating `startedAt` alone puts "Accepted" before "Asha asked" in the timeline. This is a test artefact.

### Data changed in `lendshelf-dev`
- Sapiens loan (Ravi → Asha): created, backdated, put back to its original dates, due date changed to 25 Dec in the app, then closed as Not collected. Sapiens is available again.
- QA Retest Pixel request (Ravi → Asha): created and backdated 7 days, then expired by the job. Left as is, in both users' Recent lists.
- The job runs also sent one "Request expired", one "Due soon" and six "Overdue" pushes, and Change due date sent "Due date changed". None were delivered: no tokens.

### End state
Web server stopped and viewport reset. Phones were not used.
