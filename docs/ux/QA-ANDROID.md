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
