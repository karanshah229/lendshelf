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

## Two-phone scenarios (2026-11-27)

Scenarios S0–S19 from [MULTI-DEVICE-TESTS.md](MULTI-DEVICE-TESTS.md), run on two physical phones at the same time against `lendshelf-dev`, dev build at `b61b841`. Phone A (Android 16) played Asha. Phone B (Android 17) played Ravi, then Meera, then a throwaway user (04), then Ravi again. Meera also used the web build (`APP_ENV=dev`, port 8083, 375 × 812); web sign-in got no image challenge this time.

Every title added starts with `MD<n>`, except "Siddhartha" (S11 needs a catalogue book). Phone B has no WhatsApp, so its hand-offs opened the browser and were backed out. Phone A's WhatsApp chats were checked for recipient and text, then backed out; nothing was sent.

"Live" times run from the tap on one phone to the change on the other, read with UI dumps (about 1 s resolution), so they include the callable.

| ID | Result | Notes |
|---|---|---|
| S0 | Pass | Asha sees Ravi's and Meera's books; Ravi sees Asha's, not Meera's; Meera (web) sees Asha's only. Guard: after the test contacts were removed, Sync now on phone A showed "Your contacts look incomplete · Keep everyone / Remove 2 people"; Keep everyone left "Some contacts weren't checked · Sync now". On phone B (no numbers left in the address book) Sync now does nothing visible (polish). |
| S1 | Pass | Request card on phone B; accept with 2 weeks; borrower card "Ravi said yes · Pick up from Ravi · pickup: QAdesk" and Loans badge "2 need you"; I've returned it (behind "Did you give … back?") → owner card "says they returned"; Got it back → borrower's Loan "Returned · Confirmed" with "How was it?" stars; owner toast "Back on your shelf". Timeline has all four rows on both phones. Live: 4–9 s. WhatsApp ask greets "Hi Ravi!". |
| S2 | Pass | Borrower rows: "Ravi is reading it right now", "Ravi isn't lending it at the moment", "Lent to someone else · We'll tell you when it's back". The back-watch document exists for the third. "Also stop lending this copy" is offered with Not lending. Live: about 5 s. |
| S3 | Pass | Grouped card "2 people want MD3 Asha Shared" with "Lend to LendShelf Test Ravi" / "Lend to LendShelf Test Meera" (full names kept apart; earlier bug 4 fixed). The due sheet names Meera's decline. Success sheet: Tell Ravi + Tell Meera ("Sorry, … just went to someone else. It should be back around …"). Meera's web Book page switched to "Lent · back 18 Dec" within 5 s; her Loans: "Lent to someone else · back around 18 Dec · We'll tell you when it's back". When the loan closed (S6), her watch fired ("Available again") and was deleted. |
| S4 | Pass | Cancel while the Accept sheet was open: the sheet closed by itself and a toast said "… cancelled this request" about 2 s after the tap. Simultaneous accept + cancel: cancel won and no error code appeared, but phone B showed the toast twice (polish). |
| S5 | Pass | Borrower Loan: "Ravi hasn't got it back yet · From Ravi · due 18 Dec" with Message, I've returned it, Ask for more time (earlier bug B fixed: no pick-up wording). Timelines on both phones keep all six rows, including "not back yet". |
| S6 | Pass | Ravi as owner: "Not collected? Close this loan" → borrower Loan "Not collected · Ravi closed this loan because it wasn't picked up", no review prompt, live in 5 s. Watchers checked with Asha as owner and Meera as watcher (MD3): the server pushed "Available again" to Meera (no tokens) and cleared the watch. |
| S7 | Pass | Owner's change sheet → "Due date moved to 25 Dec" with Tell on WhatsApp. The borrower's open Loan updated in 9 s: "due 25 Dec", timeline "… lent it to you (due 18 Dec)", then "Due date moved to 25 Dec". |
| S8 | Pass | Asha had the copy page open; Ravi set it Hidden: within 5 s "This copy isn't shared any more · See other copies of this book". Moving a requested copy to a private collection asked "Move … to Ravi private? … declines …'s request" → Move and decline; Asha's row: "isn't lending it at the moment". |
| S9 | Partly | Spec refinement: E9 says deleting a collection moves its books ("No books are deleted"), so a request can't close as "copy removed". Moving them to a shared collection keeps the request, as specified. Moving them to a private collection is the case that matters, and it fails (bug E). |
| S10 | Pass | Lend a book → app contact Asha → "With you · from Ravi · due 18 Dec" on phone A. |
| S11 | Pass | Asha wishlisted catalogue "Siddhartha" (the label turns to "Remove from wishlist"); Ravi added the same work; Asha's Home shows "From your wishlist · Available from LendShelf Test Ravi". Server: "On your wishlist" push attempted, skipped for no tokens. |
| S12 | Pass | Copy lent to a non-app person; Asha's copy page "Notify me when it's back" → "Stop notifying me"; Got it back → "Book is back" attempted for Asha, watch deleted, and Asha's open copy page switched to "Available to borrow · Ask". |
| S13 | Pass | Ravi borrowed MD16 from Asha, returned it and rated it 4 stars with text. Asha's Book page shows the review; Meera's web Book page: "No reviews in your circle yet". |
| S14 | Partly | Both phones had the same request open: a decline showed on the borrower's Loan in 5 s. Force-stop and relaunch on both: Home in 4–8 s with matching counts. Pull to refresh still doesn't exist (no `RefreshControl`). |
| S15 | Pass | Ravi → sign out → Meera on phone B: Home, My books, Loans, Me, the circle and the wishlist were all Meera's; Ravi's search draft was gone; the contacts row showed Meera's own result; kill and reopen kept it. Back to Ravi: overdue card, 18 books, 1 contact and pickup note all back. |
| S16 | Pass | Throwaway (04) asked Asha for MD16, Asha lent it, 04 deleted the account (the pre-check named the borrowed book). Asha's Loan: "Tara left LendShelf · You can still mark it back or message them on WhatsApp", borrower row "Left LendShelf"; Got it back closed it. Auth user and profile gone. |
| S17 | Pass | MD10 (Ravi → Asha) due date backdated; job: `overdue: 1`, "Overdue" to both (no tokens). Both Homes: "1 day overdue" cards, strip "1 overdue", Loans badges. Nudge on phone B opened a `wa.me` link in the browser (text not visible there). Ask for more time on phone A opened WhatsApp: "Hi Ravi! Could I keep "MD10 Lend" a little longer? Maybe till 4 Dec?". |
| S18 | Pass | `lendshelf://loan/<id>` of a Ravi → Meera loan on phone A: "This isn't shared with you any more · The loan was removed, or you're no longer part of it" + Back. No data shown, no crash. |
| S19 | Pass | Phone A (never asked): after the first Ask, "Get told when … answers?" → Turn on → OS dialog → Allow; Me shows "On". Phone B: permission reset with `pm revoke` + `pm clear-permission-flags`, then Meera's first Ask showed the pre-prompt and the OS dialog; Allow → "On". Logcat: no EAS projectId, so no token. |

### Bugs

**E. Minor: deleting a collection into a private one leaves pending requests open.**
- Steps: Ravi creates a shared collection and puts a book in it; Asha asks for it; Ravi › Collections › Delete › Move books to "Ravi private" › Delete collection.
- Expected (E9): the same named confirm as Make private / Move to private ("… declines Asha's request"), then a `notLending` decline.
- Actual: the dialog only says "contacts won't see these books any more". The request stays `requested`. Asha's Loan still says "Request sent · Ravi can answer in LendShelf" for a copy she can no longer see, and Ravi still has the card.
- Cause: `src/app/(app)/shelves.tsx:240-242` calls `deleteShelf` directly; only `togglePublic` (`:96-113`) collects requests and declines them first. The server's `deleteShelf` (`functions/src/handlers/shelves.ts`) doesn't decline either.
- Screenshots: `b28-delete-to-private.png`, `a20-request-on-private.png`.

**F. Minor: lending to the number of someone already on LendShelf says they aren't.**
- Steps: Lend a book › Someone else › a name and a number that belongs to an app user the owner hasn't saved › Lend.
- Expected (E7 edge case): loan linked; the owner sees "On LendShelf".
- Actual: the loan is linked (the borrower sees it under With you), but the success screen says "Meera isn't on LendShelf. Invite them?".
- Cause: `src/app/(app)/lend/[itemId].tsx:229-233` decides from `borrower.uid`, which is set only when an app contact was picked. `recordLoan` returns only `{ loanId }` (`functions/src/handlers/loans.ts:333`), so the client never learns that the number matched.

### Polish
- The stale-sheet toast shows for only about 2–3 s. In the accept/cancel race it appeared twice: once from the live check (`src/features/loans/loan-sheets.tsx:228-233`) and once from `resolveStale` after the failed call. F8 says toasts only repeat inline state, but here the toast is the only explanation of why the sheet closed.
- A saved name whose first word is "LendShelf" gives copy such as "LendShelf can see it in LendShelf", "Get told when LendShelf answers?" and "Thanks. LendShelf and others can see it". It's a test-name artefact, but any short name equal to the app name reads oddly.
- Me › Contacts › Sync now gives no feedback when the address book has no numbers (`src/app/contacts.tsx:105-112`: `skipped` → `setFound([])`; nothing visible changes and "Checked 6 min ago" stays).
- After a borrower leaves, the owner's Loans row still says "Waiting for Tara to pick up"; only the Loan screen says she left.
- Home search rows say "With you · borrowed from Ravi" during the pick-up window (elsewhere: "Pick up from Ravi").
- A deep link to a loan you were never part of says "isn't shared with you any more".
- Tapping Clear search on Home also focuses the field and opens the keyboard.
- `reminderKind` (`functions/src/lib/loans.ts:169-177`) sends the first "Overdue" only in the 24 h after the due time. A date-only due date (noon IST) is caught by the 09:00 run, but a manual run later in the day skips it (S17: the first run gave `overdue: 0`).

### Timings (this run)

| Action | Observed |
|---|---|
| Ask → WhatsApp or browser hand-off | 2.5–3.5 s (7 s once, the first ask by a new user on the phone) |
| Accept or Lend → success sheet | 3.6–9 s |
| Other phone shows the change (from the tap) | 4–5 s typical; 9–13 s when the callable itself was slow |
| Send code / verify | 11–46 s / 3–4 s (timed with dump polling, so inflated) |
| Kill and reopen → Home with data | 4–8 s |

### Not tested
- Push delivery: no EAS projectId, so no tokens; every push logs "Push skipped: no tokens".
- Nudge text on a phone: phone B has no WhatsApp and the browser intent URL is redacted in logcat. The text was checked in the earlier web run.
- S9 "request closes as copy removed": not possible by design (deleting a collection never deletes books).

### Data in `lendshelf-dev`
- Ravi: MD1 Hobbit (now in "Ravi private"), MD2 Dune A/B/C, MD4 Race, MD5 Dispute, MD6 Pickup, MD8 Hide A (Hidden), MD8 Hide B (Ravi private), MD10 Lend, MD12 Watch, MD18 Private, Siddhartha. Collection "MD9 Shelf" was created and deleted.
- Asha: MD3 Asha Shared, MD16 Asha Lend; wishlist "Siddhartha". Meera: MD1 Meera Garden.
- Every loan created in this run is closed (returned, declined, cancelled or not collected). MD10's `dueDate` was backdated to `2026-11-26T06:30Z`, then `2026-11-26T12:00Z`, before it was closed. The job run sent one round of "Overdue" (no tokens).
- Throwaway 04 created and deleted. Asha's links to Ravi and Meera kept ("Keep everyone").

### Fixes after this run
- **E fixed:** deleting a shared collection into a private one now shows the named confirm ("Delete Fiction? … The request from Asha (Dune) will be declined.") and declines with `notLending` before the delete (`deleteToPrivateSheet`, shelves screen).
- **F fixed:** `recordLoan` returns `onApp` (the number belongs to someone on LendShelf), so the success screen says "They'll see it in their Loans tab" and offers no invite. Redeployed to dev.
- **Overdue timing fixed:** `reminderKind` goes by calendar day in India time: Due soon the day before, Overdue the day after and weekly, whatever hour the job runs. Redeployed to dev.
- **Polish fixed:** the stale-sheet toast shows once (deduped for 10 s) and stays 6 s; Sync now with no numbers says "Your address book has no phone numbers to check."; the owner's Loans row says "Tara left LendShelf" after the borrower deletes their account.
- **Still open (polish):** Home search rows during the pick-up window, the "LendShelf" short-name artefact, the deep-link wording for loans you were never part of, Clear search opening the keyboard, no pull to refresh.

### Re-check on phones (2026-11-27)
Phone B (Ravi) on the build with the fixes; phone A (Asha) on the earlier build. Titles start with `RC`; every RC loan is closed.
- **E: Pass.** Delete "RC Shelf" › Move books to "Ravi private" › Delete collection → sheet "Delete RC Shelf?" naming the request ("The request from … (RC1 Collection book) will be declined.") with Delete and decline. After confirming, the collection is gone, "Ravi private" went from 3 to 4 books, Asha's Loans row read "Ravi isn't lending it at the moment · Declined" 6.8 s after the tap, and Ravi has no request card.
- **F: Pass.** Lend a book › Someone else › Meera, 9000000003 → "Lent to Meera · … They'll see it in their Loans tab." with Tell them on WhatsApp and Done; no invite box. Closed with Got it back.
- **Stale toast: Pass.** Cancel while the Accept sheet was open: the sheet closed and "… cancelled this request" showed once, from 3.6 s after the cancel tap, for about 6.4 s (on-device frame capture every 0.4 s). Near-simultaneous cancel + Lend (sheet showed "Lending…"): cancel won, one toast for 6.0–6.4 s, no repeat in the next 16 s, no error.
- **Sync feedback: Pass.** Me › Contacts › Sync now with no numbers in the address book → "Your address book has no phone numbers to check." under the count.
- **New (polish):** on Add a copy, after picking "RC Shelf" the button's visible label is cut to "Add to RC" (its accessibility label is "Add to RC Shelf"). The short-name artefact also shows in the new sheet and toast ("The request from LendShelf …", "LendShelf cancelled this request").

### End state
- Test contacts deleted on both phones. On phone A the OS had moved them into the phone's Google account, and WhatsApp had added its own entries for them; all were deleted, so the two Google contacts will be in that account's Contacts bin.
- Phone B's notification permission is granted again after the S19 reset. No test images were used.
- Web server stopped. Phone A is signed in as Asha and phone B as Ravi, both on Home.
