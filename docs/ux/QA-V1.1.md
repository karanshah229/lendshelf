# LendShelf UX v1.1: QA report

Tested 21 Nov 2026 on the web dev build (http://127.0.0.1:8081) against the Firebase emulators, at the 375 × 812 mobile preset. Spec: `docs/ux/UX-FLOWS.md` (Decision log, §D, §E, §F, §G "UX v1.1 cut"). Build under test: the uncommitted working tree on `main`. Screenshots: `docs/ux/screens/qa-*.png`.

## Verdict

**Not ready to ship as is, but close.** I found no blockers. Every acceptance check that can be run on the web passed or mostly passed. The backend states (B2–B6) all behaved correctly in the emulator. The new Loan screen, the grouped request card with its chooser, hide-with-requests, the delete pre-check and the owner-left states hold together well.

Five major problems remain:

1. A borrower gets no in-app sign when the owner says "Not back yet".
2. Saved names are shortened to their first word, so "Dr. Mehta" becomes "Message Dr." and "Waiting for Dr. to pick up".
3. Acting on a stale request (cancelled or expired) shows a raw server error ending in "[400]".
4. Asking from a Home card leaves no "Request sent" receipt on Home.
5. The demo seed loses its two "requested" loans about 17 seconds after seeding.

There are also about 20 minor and polish items. Push notifications, the camera, the address book, TalkBack, 200 % font and auto re-sync can't be tested on the web; they need the planned device pass.

Hygiene is clean:

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, no warnings printed |
| `npm test` | 38 suites, 366 tests passed |
| `npm --prefix functions test` | unit 92, rules 46, integration 42 tests passed |

## Acceptance checks (§G, Phase 1 client)

| # | Check (short) | Result | Evidence |
|---|---|---|---|
| C1 | "Not lending" in owner control, My books badge and contact view, with privacy help text; contact saved as "Dr. Mehta" greeted "Hi Ravi!" | **Pass** (but see B2) | Asha's Pride and Prejudice: the segmented control reads "Not lending", with the help text "People who have your number saved can see you have it, but can't ask." The My books badge reads "Not lending". Ravi's view shows "Not lending · Asha Rao has it but isn't lending it right now" (`qa-c1-viewer-not-lending.png`). I saved Ravi as "Dr. Mehta" on Asha's web contacts; the WhatsApp text began "Hi Ravi! …". The on-screen short name is wrong (B2, `qa-bug-saved-name-first-word.png`). |
| C2 | With an incoming request and a "says returned" loan, the Loans badge equals the number of cards, and both cards are at the top with no segments | **Pass** | Ravi: a "says returned" card (Meera, Project Hail Mary), a request (Kabir, Dune) and a pick-up card. The badge read 3 and all three cards were first in Loans (`qa-c2-ravi-loans-badge.png`). Asha's two requests for Sapiens counted as one card (badge 1). |
| C3 | Any loan push opens the Loan screen; Back after a cold start lands on Home | **Partly testable: pass** | There are no pushes on the web. I tested deep links instead. Opening `/loan/<id>` while signed out kept the target through sign-in and landed on the Loan screen, and Back went to Home. The `rating` param works: tapping 4 stars opened `/review/<workId>?rating=4` with 4 stars set. Push-type routing is not testable here. |
| C4 | Ravi sees "2 people want Animal Farm", lends to Asha in two taps, gets "Tell Asha on WhatsApp"; Kabir sees "Lent to someone else · back around <date>" | **Pass** (tap count 3) | Asha saw "2 people want Sapiens", then I tapped Choose who → Lend to Ravi → Lend to Ravi in the due-date sheet. That is 3 taps from the card, or 2 from the chooser. The success sheet had "Tell Ravi on WhatsApp" and "Tell Kabir on WhatsApp" with correct text (`qa-c4-*.png`). Server: Kabir's loan has `declineReason: lentToSomeoneElse` and a back-watch. Kabir's Loan screen for a still-lent copy read "Lent to someone else · back around 12 Dec · We'll tell you when it's back · Turn off "Notify me"". |
| C5 | Within 48 h of accept the borrower sees "Pick up from Ravi"; after "not collected" the copy is Available and there's no review prompt | **Pass** (push not observable) | Ravi's card read "Asha Rao said yes to Sapiens · Pick up from Asha · pickup: Indiranagar…". Asha's Loan screen showed "Waiting for Ravi to pick up" with P "Message Ravi" and T "Not collected? Close this loan" (`qa-c5-owner-pickup-loan.png`). Ravi closed Kabir's Dune as not collected: the banner read "Not collected · It's available again", `closedReason: notCollected` was set and the copy was `available` (`qa-c5-not-collected.png`). That no review push was sent can't be seen on the web; the backend tests cover it. |
| C6 | Delete pre-check lists the book out with a WhatsApp button; the borrower's Loan says "<owner> left LendShelf…" | **Pass** | Throwaway user Tara: the sheet listed "The Hobbit · with Asha [Tell Asha]", "You have Malgudi Days from Asha…", the non-app loan, "Your 1 open request will be cancelled" and Export (`qa-c6-delete-precheck.png`). Afterwards Asha's loan was `ownerLeft` with the phone blanked, and the banner read "Tara left LendShelf. If you still have The Hobbit, message them on WhatsApp if you still have their number." (`qa-c6-owner-left.png`) |
| C7 | 375 × 812 with 4 Needs-you items: 2 cards, "See all 4 in Loans" and the top of the People row with no scrolling | **Pass** | `qa-c7-home-4-cards.png` |
| C8 | Popular hidden when I own every book in it; nothing in both New and Available | **Pass** (partly set up) | For the new user, Piranesi appeared under "New this week · Asha added Piranesi" and not under Available. Ravi's Popular lists only books he doesn't own. Popular is hidden for a one-friend circle. I didn't build the exact "own every Popular book" case. |
| C9 | Copies under two catalogue records with the same title and first author both show on either Book page | **Pass** | I moved Kabir's Sapiens to a second work with the same title. Both Book pages listed Asha, Kabir and Meera, with "Other edition" on the cross-record rows (`qa-c9-book-merged.png`). A subtitle variant ("Sapiens: A Brief History of Humankind") was **not** merged; see Friction. |
| C10 | New user with 0 matches sees the title and "Invite friends on WhatsApp"; a joining friend appears the next day; auto-sync never removes | **Partly testable: pass** | The 0-match result screen matches E2a(i) (`qa-c10-zero-matches.png`). The invite opens WhatsApp with the text, plus an "Invite shared" toast. The B1 guard works from Me › Contacts › Sync now: "Your contacts look incomplete… Keep everyone / Remove them". Auto re-sync after 24 h and "New on LendShelf" are not testable on the web. |
| C11 | Notification permission isn't asked until the first request, asked once with a reason | **Not testable on web** | No pre-prompt appeared on the web for Ask, Accept, Lend or Wishlist, which is expected because the web build has no push. |
| C12 | Hiding a copy with requests from Ravi and Kabir names both; both declined `notLending`; nobody sees "Copy not found" | **Pass** (slow) | The sheet read "Hiding "The Alchemist" declines requests from Ravi and Kabir…". Both loans became `declined/notLending` before the item became `hidden` (by server timestamps). Ravi's Recent row read "Asha isn't lending it at the moment". The sheet sat on "Declining…" for about 40 s; see Friction F1. |
| C13 | "sapiens harari" lists the main Sapiens first; a hand-entered matching title shows "Is it one of these?" | **Pass** | `qa-c13-is-it-one-of-these.png` (typed "The Kite Runner / Khaled Hosseini"). |
| C14 | TalkBack + 200 % font | **Not testable on web** | Web accessibility-tree notes: Needs-you cards are a `button` that contains other buttons, and the Home, My books and Me tab items have no accessible name (only Loans does: "Loans, 3 need you"). Recheck both on a device. |

## Bugs (by severity)

| ID | Severity | Screen | Steps to reproduce | Expected | Actual | Likely file |
|---|---|---|---|---|---|---|
| B1 | **Major** | Loan (borrower) | Borrower taps "I've returned it" → Yes. The owner taps "Not back yet" (or `call.js 9000000001 markNotReturned`). Look at the borrower's Loan screen and Loans. | Banner "Asha hasn't got Sapiens back yet" with P "Message Asha" (E4 table, B3 row). | The loan silently returns to "With you · From Asha · due 19 Dec" with "I've returned it" again. The timeline entry "You said you returned it" disappears and there is no "not back yet" entry. On the web (no push) the borrower has no idea why (`qa-bug-not-back-yet-borrower.png`). The server clears `returnMarkedAt` and stores no marker, so the client can't know. | `src/features/loans/loan-view.ts` (no borrower state for it); `functions/src/handlers/loans.ts` `markNotReturned` (no field such as `notReturnedAt`) |
| B2 | **Major** | Loan, Needs-you cards, Recent | On Asha's web contacts, save Ravi's number as "Dr. Mehta", then Sync now → Keep everyone. Open the Sapiens loan. | The saved name "Dr. Mehta" is shown in full, or a sensible short form. | "Waiting for Dr. to pick up", button "Message Dr.", "Dr. wrote", "Dr. asked", and in Recent "You declined Dr.'s request" (`qa-bug-saved-name-first-word.png`). This is the R21 problem moved from the greeting onto the screen. | the short-name helper used by `src/features/loans/loan-view.ts` and the Recent rows (first word of the saved name) |
| B3 | **Major** | Decline sheet / Accept sheet | (a) Open Decline on Kabir's request, then cancel it from his side (`call.js 9000000004 cancelRequest`), then tap Decline. (b) Accept a request older than 7 days (I backdated `requestedAt`). | (a) The card animates away, the sheet closes and a toast says "Kabir cancelled" (E5). (b) "This request expired. Message Meera?" (E4/E5). | (a) The sheet stays open on a request that no longer exists, and every tap shows "Can't decline this request: this loan is already cancelled. [400]" (`qa-bug-stale-decline-400.png`). (b) Toast "This request expired (requests last 7 days). [400]" with no Message action (`qa-bug-expired-accept-400.png`). | `src/features/loans/loan-sheets.tsx` (close the sheet when the loan leaves `requested`; map `failed-precondition`) and the error-to-text mapping in `src/lib/api.ts` (status code shown) |
| B4 | **Major** | Home › Available to borrow | As Ravi, tap Ask on Zoya's Animal Farm card → Send request, then come back from WhatsApp. | The persistent "Request sent · Zoya can answer in LendShelf" state with "Message Zoya again" on the screen I asked from (E4 step 3, F7). | The card disappears from Available (requested items are excluded) and nothing on Home confirms the request or offers "Message Zoya again". The receipt is only in Loans › Your requests. The Copy page does it right. | `src/features/discover/DiscoverHome.tsx`, `src/features/copy/AskDialog.tsx` |
| B5 | **Major** (test tooling) | Seed | Run the seed, wait about 20 s, then list loans. | `loan-requested` and `loan-requested-2` stay `requested`. | Both were `cancelled` about 17 s after seeding (`updatedAt` 07:07:52 / 07:07:54; item `createTime` 07:07:53). The `onItemWritten` delete triggers from the wipe ran after the new loans existed, and `cancelRequestsForDeletedItem` cancelled them. Asha's Recent then wrongly shows "Kabir cancelled the request". I re-created the requests with `call.js` to test. | `functions/scripts/seed.ts` (wipe/trigger race); `functions/src/handlers/triggers.ts` |
| B6 | Minor | Any callable action | Block calls to `:5001` (I stubbed `fetch`) and tap Got it back. | "You're offline" with the button disabled, or a toast with Retry (E3, E4, F4). | Toast "Something went wrong on our side. Please try again." There is no Retry, and the app has no offline handling anywhere (no `NetInfo`/`onLine` use in `src/`) (`qa-bug-network-error-copy.png`). | `src/lib/api.ts` error mapping |
| B7 | Minor | Accept sheet | Sign in as Meera (no pickup note) and Accept Ravi's request. | Inline "Where can they pick it up?" with "Don't ask again" (E5 step 2, E13). | No pickup field; the due-date sheet only. | `src/features/loans/due-date-dialog.tsx` |
| B8 | Minor | Loan (borrower) after review | Close a loan, tap a star on "How was it?", Post review, return. | "Thanks. Asha and others can see it." (E10). | The Loan screen still shows five empty stars and "Tap a star to review it". The review was saved. | `src/app/(app)/loan/[loanId].tsx` |
| B9 | Minor | Loan timeline | Change the due date from 12 Dec to 19 Dec. | Timeline: "Accepted (due 12 Dec)" then "Due date moved to 19 Dec" (D4). | The accepted row is rewritten to "Accepted (due 19 Dec)", with no move entry. | `src/features/loans/loan-view.ts` |
| B10 | Minor | Loan (owner), active | Open Ravi's The Martian (accepted 19 days ago) or any overdue requested loan. | "Not collected? Close this loan" only in the 48 h pick-up window (E4, D4). | It shows on every active loan that came from a request, including overdue ones. Closing one as "not collected" skips the review and sends "available again". | `src/features/loans/loan-view.ts` lines ~200, 210 (`loan.requestedAt && 'notCollected'`) |
| B11 | Minor | Needs-you card | On a "says returned" card tap Not back yet → confirm. | A spinner on Not back yet. | The spinner shows on **Got it back** while Not back yet runs, so it looks as if the return was confirmed. | `src/features/loans/needs-you-card.tsx` (one shared `busy` for every button) |
| B12 | Minor | Loan (declined, lentToSomeoneElse) | Kabir's Sapiens request is declined as lent to someone else; later the copy is returned. Open Kabir's loan. | Something like "It's back on Asha's shelf · Ask". | "Lent to someone else · Notify me is off · [Notify me when it's back]" for a copy that is available now (`qa-friction-declined-after-return.png`). | `src/features/loans/loan-view.ts` |
| B13 | Minor | Loan (owner), borrower deleted account | Asha lends Malgudi to Tara; Tara deletes her account. Open Asha's loan. | "Tara left LendShelf" (E4 failure exits). | "Tara · Not on LendShelf", which reads like a hand-recorded loan. | `src/features/loans/use-loan-people.ts` / `loan-view.ts` |
| B14 | Minor | Needs-you order | Create several requests the same day. | Oldest deadline first (D4). | Ties at day granularity are sorted by item id, so a newer Gatsby request shows above an older Midnight's Children one. A request already past 7 days shows "expires today". | `src/features/loans/needs-you.ts` `requestExpiresAt` / sort |
| B15 | Minor | Request chooser | Open "2 people want Sapiens". | T "Decline all" at the bottom (E5). | Not present. | `src/features/loans/loan-sheets.tsx` |
| B16 | Minor | Owner Recent | A request cancelled because the copy was deleted. | "Request cancelled · copy removed" or similar. | "Kabir cancelled the request". | `src/features/loans/buckets.ts` |
| B17 | Minor | Add books | Type a title in "Type it in", then tap the header Back. | "Discard …?" confirm (F2: confirm if data would be lost). | Leaves at once and the typed data is lost. | `src/app/(app)/add.tsx` |
| B18 | Minor | Home setup card | New user taps Check my contacts (0 matches), then Continue. | "Find your people" ticked ✓ (E2a). | Shows "Get set up" with no ticks until a friend is found ("1 of 3" only after Asha matched). | `src/features/home/setup-card.tsx` |
| B19 | Minor | Ask sheet | Ask to borrow any copy. | Book, owner, **pickup note**, optional note (E4 step 1). | No pickup note on the sheet. | `src/features/copy/AskDialog.tsx` |
| B20 | Polish | Loan / Lend | Borrower named "Nikhil (neighbour)". | Initials "NN" or "N". | Avatar shows "N(" (`qa-bug-initials-paren.png`). | avatar initials helper |
| B21 | Polish | Delete pre-check | Open Delete account with a book out. | Text fully visible. | "Tell them first?" is clipped under the scrollbar ("Tel"). | `src/features/me/delete-account-dialog.tsx` |
| B22 | Polish | Contacts (web) | Add 1 or more contacts. | The last row is visible. | The sticky Sync now / Invite footer covers the last contact row. Reloading `/contacts` shows no back button (dead end on a web deep link). | `src/app/contacts.tsx` |
| B23 | Polish | All sheets | Open any sheet. | No console noise. | `[Reanimated] Couldn't load entering/exiting animation` warning on every sheet (about 20 per session). Other console errors were only the auth emulator's reCAPTCHA 501 and the 400s from B3. | `src/components/ui/dialog.tsx` |
| B24 | Polish | Toasts | Any toast after an action on a pushed screen. | Back stays tappable. | The toast covers the header back button for about 4 s. | toast placement |
| B25 | Polish | Vocabulary | My books badge for a lent copy; Me › Wishlist subtitle. | F6: owner view "Out · back 28 Nov"; social copy uses "friends". | Badge "Back 28 Nov"; subtitle "Books you'll be told about when a **contact** adds them". | `src/components/status-badge.tsx`, `src/app/(app)/(tabs)/me.tsx` |

## UX friction (works, but confusing)

- **F1. Slow writes leave long spinners.** Client Firestore writes in this environment took 25–40 s to be acknowledged: hide (C12), review "Saving…", wishlist heart, adding a book. Callables through `call.js` took about 1 s, so this is probably the emulator or web transport, not the app. Still, the hide sheet keeps **Cancel enabled** during "Declining…", and declines run one at a time. Check on a device.
- **Two cards for one book.** After an accept with another request open (R14), the borrower gets two cards for the same book: "Asha Rao said yes to Sapiens" and "Asha said yes to Sapiens. Cancel your request to Meera?". The adjacent cards also use the name differently ("Asha Rao" vs "Asha").
- **Success sheets claim delivery.** They say "Ravi gets a notification" and "Meera has been told". That contradicts F7: the app can't know whether push is on.
- **Change due date message.** The text after changing the due date is always "No problem, keep "Sapiens" till 19 Dec", which reads wrong when the owner *shortens* the loan.
- **Available to borrow includes books I own.** Ravi sees Kabir's Dune and The Name of the Wind, which he owns himself. Popular already excludes them; Available doesn't.
- **Subtitles defeat C9 merging.** Copies filed as "Sapiens" and "Sapiens: A Brief History of Humankind" are not merged. Reviews are never merged across records.
- **Confirm text for non-app borrowers.** "Got it back" for a non-app borrower says "Nikhil hasn't said they returned it", but he can't say so; he isn't on the app.
- **Duplicate change-date action.** The Loan screen for a reading loan offers "Change due date" in the banner and "Change" on the due row.
- **Invite text has no link.** The invite says "Ask me for the app link", so the invite loop needs a second message (H1 prerequisite still open).
- **Name screen copy.** "This is how people who haven't saved your number see you" is puzzling, because people who haven't saved you can't see you.
- **Returning user copy.** A returning user on a new device gets the plain "Find your people" screen, not "Welcome back. Re-check your contacts on this phone" (E1).
- **Add confirm layout.** The Add confirm step shows the Collection picker with only one collection, and Format/Language are not collapsed (E8).
- **Viewer copy page shows the ISBN.** G15 is backlog, so this is noted only.
- **Covers.** Covers often render as empty grey boxes with no title placeholder while Open Library loads.

## Flows as real people (taps counted from the starting screen)

| Flow | Taps | Next step obvious? | Other party correct? | Notes |
|---|---|---|---|---|
| Ravi: find something and ask | 2 (Ask → Send) + scroll | Yes | Zoya: request created, WhatsApp text correct | No receipt on Home (B4). Double-tapping Send made one request and one WhatsApp. |
| Asha: two requests for one book | 3 (Choose who → Lend to Ravi → Lend to Ravi) | Yes; the due sheet warns about Kabir | Kabir declined `lentToSomeoneElse` with a back-watch | Double-tapping "Lend to Ravi" made a single loan. |
| Who has my books / overdue, Nudge, Got it back | 0 (status strip) / 1 (Loans); Nudge 2; Got it back 2 from a row (+ confirm) | Yes | Meera's back-watch on HP1 was cleared on return | Overdue card: P Nudge, S Got it back, T calendar icon (accessible label "Change due date"). |
| "I returned it" → "Not back yet" | Borrower 2; owner 2 | Owner yes; **borrower no** (B1) | Server is correct (`active`, `returnMarkedAt` null) | |
| Change a due date | 3 (Change → chip → Save) + 1 WhatsApp | Yes | `dueChanged` push not observable; Ravi's strip showed "due 19 Dec" | B9 timeline. |
| Lend in person to a non-app person | 5 (Lend a book → copy → Someone else → Use this person → Lend) + typing | Yes; warns "Meera asked for this" | Meera declined `lentToSomeoneElse` with a watch | A 60-character name wraps fine. Back from success goes to Loans (good). |
| Hide a copy with a pending request | 2 (Hidden → Hide and decline) | Yes | Both requesters see a normal decline | About 40 s wait (F1). |
| New user, 0 matches, then invite | 1 | Yes | n/a | Empty states on Home, My books and Loans match E2a(i). |
| Add a book by search / by hand | 3 / 4 | Yes | n/a | "Is it one of these?" appears only when the title matches. |
| Review after return | 2 (star → Post) | Yes | Review visible on the Book page | B8. |
| Wishlist, then available | 1 (heart) | Yes | When Asha's copy appeared: "From your wishlist · Available from Asha Rao · Ask" | |
| Delete account with a book out | 3 + type DELETE | Yes | Asha `ownerLeft`; non-app loan deleted; open request cancelled; Asha's loan to Tara kept | B13 on the owner side. |

## Not testable on web

- Push delivery and push-tap routing (C3 push half, C11, all "Borrower: push …" rows in E4, B2's "no review prompt", B6's `dueChanged`).
- The Android ≤ 12 notification line.
- Camera / Scan mode and "Camera is off".
- Address-book contacts, permission-denied case E2a(iii), auto re-sync on foreground after 24 h, and the "New on LendShelf" chip (C10 second half).
- The WhatsApp app itself. All `wa.me` URLs were captured by stubbing `window.open`, and every prefilled text was checked.
- TalkBack/VoiceOver and 200 % system font (C14). Android back behaviour.
- The Export share sheet.

## Test-data changes left in the emulator

Kept so the build owner can reproduce. A reseed clears them, but see B5.

- Extra requests and loans on Asha's, Ravi's, Meera's and Zoya's copies.
- Asha's Alchemist is Hidden.
- Asha has a manual contact "Dr. Mehta" (Ravi) in this browser's storage.
- Item `item-asha-piranesi-qa` was written directly to Firestore.
- Throwaway user +91 9000000031 (Tara) was created and deleted.
- A few `requestedAt`/`startedAt` values were backdated to reach the expiry and post-pick-up states.

## Fixes after QA

Fixed on 21 Nov 2026 in the same uncommitted working tree, then re-tested on the web dev build at 375 × 812 against a fresh `npm run seed`. Screenshots of the fixes are `docs/ux/screens/fix-*`.

Checks after the fixes:

| Command | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0, no warnings |
| `npm test` | 40 suites, 387 tests passed (was 366) |
| `npm --prefix functions test` | unit 92, rules 46, integration 44 passed (182, was 180) |

### Slow web saves (F1): root cause

**Only affects web dev against the emulator with several tabs open; no app change needed.** The Firestore emulator speaks HTTP/1.1, so Chrome allows 6 connections to `127.0.0.1:8080`, shared by every tab. Each open app tab keeps its Firestore Listen (and, after a write, Write) WebChannel long-poll requests hanging on those connections. With 4 tabs on :8081 and 1 on :8082 open, a write waited for a free connection. Callables go to :5001, which has its own pool, so `call.js` and callables stayed fast.

Production Firestore uses HTTP/2 (one multiplexed connection) and native uses gRPC, so users aren't affected. The app uses the default memory cache, with no `persistentMultipleTabManager` and no long-polling settings, so neither of those suspects applied.

| Measurement (wishlist heart on a Book page, from tap to the doc changing in the emulator) | 5 tabs open | 1 tab open |
|---|---|---|
| Add to wishlist | 13.0 s | 0.3 s |
| Remove from wishlist | 16.2 s | 0.14 s |

I closed the 4 extra tabs after measuring. A comment next to `connectFirestoreEmulator` in `src/lib/firebase/index.ts` records this. The hide sheet already disables Cancel while declining, and `declinePendingRequests` already declines in parallel, so the 40 s wait in C12 came from the same queue.

### Status of every QA item

| QA ID | Status | What changed | How verified |
|---|---|---|---|
| B1 | Fixed | Server: `markNotReturned` sets `notBackYetAt`; `markReturned` and `confirmReturn` clear it (`functions/src/model.ts`, `handlers/loans.ts`, `src/types/model.ts`). Borrower: Loan banner "Kabir hasn't got it back yet" with P **Message Kabir** (reply "You said … isn't back yet. I'll check and get back to you."), S I've returned it / Ask for more time; a timeline entry; a Needs-you card on Home and Loans for 3 days; the With-you row reads "Kabir hasn't got it back yet · due …" with a **Message** button. | Integration tests (set, cleared on re-mark and on confirm). Unit tests for the view, timeline, card and row. Browser: `call.js 9000000004 markNotReturned` on Asha's Atomic Habits, then Asha's Home, Loan and Loans (`fix-b1-*`); WhatsApp URL captured. |
| B2 | Fixed | One `shortName()` in `src/features/shared/people.ts` replaces 12 copies of "first word". Normal names give their first word. A name that starts with a title or initial stays whole ("Dr. Mehta", "Mrs. A. Iyer"). Bracketed notes are dropped, and a phone number shown as a name is never cut. WhatsApp greetings still use the profile name, and never say "Hi Dr.!". | Unit tests with "Dr. Mehta", "Mrs. A. Iyer", "A. Iyer", single words and a phone number. Browser: Ravi saved as "Dr. Mehta" → "Dr. Mehta wants to borrow it", "Dr. Mehta wrote", "Dr. Mehta asked", greeting "Hi Ravi!" (`fix-b2-saved-name.jpg`). |
| B3 | Fixed | `errorMessage` strips the web SDK's " [400]" suffix. It rewrites server text like "this loan is already cancelled" in plain words, and maps `failed-precondition` / `not-found` / `permission-denied` / `already-exists` errors with no usable message to plain text. New `src/features/loans/stale.ts` says what happened: "Kabir cancelled this request", "This request expired" + **Message Kabir**, "You already lent it to …". A loan sheet closes by itself when the live loan leaves the state it was opened for, and after a stale-state error from the server. A request past its 7 days now shows "Request expired" with P Message on the Loan screen instead of Accept. | Unit tests (`errors.test.ts`, `stale.test.ts`, loan view). Browser: with the Decline sheet open on Kabir's request, `call.js 9000000004 cancelRequest` → the sheet closed and "Kabir cancelled this request" showed (`fix-b3-cancelled-under-sheet.jpg`). Accept on a backdated request → "This request expired · Message Dr. Mehta", no sheet (`fix-b3-expired-accept.jpg`). |
| B4 | Fixed | Home shows a "Request sent · *title*" receipt at the top of the feed for requests sent from Home. It has "Zoya can answer in LendShelf", **Message Zoya again**, Open request and a hide button. It goes away once the request is answered. | Browser as Ravi: Ask on Zoya's To Kill a Mockingbird → receipt shown after WhatsApp; Message again opened the follow-up text (`fix-b4-home-receipt.jpg`). |
| B5 | Fixed | `seed.ts` pauses Cloud Functions background triggers (Emulator Hub `disableBackgroundTriggers`) while it wipes and writes, then turns them back on. `cancelRequestsForDeletedItem` also re-reads the copy and leaves its requests alone if the copy exists again under the same id. I first tried comparing with `event.time`, but the emulator sets it at dispatch time, rounded to the second, so I dropped that. | Integration test for the re-check. After two reseeds, both `loan-requested` and `loan-requested-2` were still `requested` 84 s and 115 s later. |
| B6 | Partly fixed | A call that never reached the server now says "Can't reach LendShelf. Check your connection and try again." When the browser is offline it says "You're offline…" instead. Failed actions from the loan confirm sheets offer **Retry** in the toast. Not done: buttons aren't disabled while offline, which needs a connectivity hook such as NetInfo. | Unit test for a request that never reached the server (HTTP status 0). |
| B7 | Fixed | While my pickup note is empty, the accept (due-date) sheet asks "Where can they pick it up?" with "Don't ask again". A typed note is saved to the profile and added to the WhatsApp text. | Browser as Meera: field shown; typed "HSR Layout, Sundays" → "Yes, you can borrow … Pickup: HSR Layout, Sundays. Due back 12 Dec." (`fix-b7-pickup-prompt.jpg`). |
| B8 | Fixed | The Loan screen reads my review live and shows "Your review" with my stars and "Thanks. Asha and others can see it. Tap a star to change it." | Browser as Zoya on the returned Dune loan (`fix-b8-review-done.jpg`). |
| B9 | Fixed | `updateDueDate` stores `dueChangedAt`, and `firstDueDate` on the first change. Timeline: "Accepted (due 8 Dec)" then "Due date moved to 15 Dec". | Integration and unit tests. |
| B10 | Fixed | "Not collected? Close this loan" shows only in the 48 h pick-up window. | Unit test. |
| B11 | Fixed | The sheets track which action is running; only that button spins, and the others are disabled. | Browser as Meera: Not back yet → spinner on Not back yet, Got it back unchanged (`fix-b11-spinner-on-not-back-yet.png`). |
| B12 | Fixed | A request declined as "lent to someone else" whose copy is available again reads "It's back on Asha's shelf" with P Ask again. | Unit test. |
| B13 | Fixed | `deleteAccount` sets `borrowerLeftAt` on loans the user borrowed. The owner's Loan banner reads "Tara left LendShelf · You can still mark it back or message them on WhatsApp", and "Not on LendShelf" no longer shows. | Integration and unit tests. |
| B14 | Fixed | `addDays` keeps seconds, so same-day requests sort by their real deadline. A request past 7 days says "expired" (never "expires today") and is no longer a Needs-you card. | Unit tests. Browser: the backdated request left Asha's Home. |
| B15 | Fixed | The request chooser has T **Decline all**. It opens one decline sheet for everyone ("Decline all 2 requests?"), then one success sheet with a Tell button per person. | Typecheck and lint; not clicked in the browser. |
| B16 | Fixed | A request cancelled because the copy was deleted gets `closedReason: copyRemoved`. Recent reads "Request cancelled · copy removed" for the owner and "Asha removed the book" for the borrower. | Integration and unit tests. |
| B17 | Fixed | Tapping Back in Add with text in "Type it in" asks "Discard this book?" (Keep editing / Discard). | Typecheck and lint; not clicked in the browser. |
| B18 | Spec question | E2a says each row shows ✓ "when done", but it lists the 0-match row as "Find your people (Invite friends)". Is "Find your people" done after a check with 0 matches, or only once someone is found? Left as is. | n/a |
| B19 | Fixed | The Ask sheet shows the owner's pickup note. | Browser: "Pickup: Jayanagar" on Zoya's book. |
| B20 | Fixed | Initials skip bracketed notes and titles ("Nikhil (neighbour)" → "N", "Dr. Mehta" → "M"). Me and the borrower picker use the same helper. | Unit tests; browser on Nikhil's loan. |
| B21 | Fixed | Right padding inside the pre-check scroll area, so the web scrollbar doesn't cover "Tell them first?". | Not re-run (needs a throwaway account deletion). |
| B22 | Partly fixed | Contacts always has Back outside onboarding; with no history it goes to Me. I couldn't reproduce the footer covering the last row: the footer sits outside the scroll area, and the last contact was visible. | Browser: reloaded `/contacts`. |
| B23 | Fixed | The warning came from sonner-native toasts, not sheets: Reanimated on web doesn't support its custom worklet animations. Web toasts now use the predefined FadeIn/FadeOut. | Browser: 0 Reanimated warnings across a sheet and a toast (before, one per toast). |
| B24 | Fixed | Toasts are offset 56 dp, below the header. | Browser: the "Back on your shelf" toast with Back visible (`fix-b24-toast-below-header.jpg`). |
| B25 | Fixed | The My books grid card reads "Out · back 28 Nov" (overdue copies keep "Overdue 3 days"). Me › Wishlist reads "…when a friend adds them". | Unit test; seen in the browser. |
| C4 tap count | Fixed | With exactly 2 requesters, the grouped card shows **Lend to Ravi** and **Lend to Kabir**, both outline because there's no ordering rule. The due-date sheet is the confirm, so lending takes 2 taps. Tapping the card still opens the chooser; with 3 or more requesters the card keeps **Choose who**. | Browser: Lend to Ravi → Lend to Ravi → success sheet with Tell Kabir (`fix-c4-*`). |
| F1 Slow writes | Explained | See the root cause above. | Measured. |
| Two cards for one book | Partly fixed / spec question | The pick-up card now uses the short name, like the R14 card next to it ("Asha said yes to …"). Merging the two cards is a spec question: F5 lists them as separate cards. | Code review. |
| Success sheets claim delivery | Fixed | Accept, decline and Not back yet now say "Ravi can see it in LendShelf" instead of "gets a notification" / "has been told" (F7). | Browser (accept and Not back yet sheets). |
| Change due date message | Fixed | When the owner moves the date earlier: "Could I have … back by 1 Dec? I've changed the due date on LendShelf." When later, it still says "No problem, keep … till …". | Unit test. |
| Available to borrow includes my books | Fixed | Books I own are excluded (matched by work, and by title and author), as in Popular. | Browser as Meera: Available showed no books she owns. |
| Subtitles defeat C9 merging | Spec question | C9 matches the normalised title and first author, and "Sapiens: A Brief History of Humankind" is a different title. Should subtitles be stripped before matching, and should reviews merge across records? | n/a |
| Confirm text for non-app borrowers | Fixed | "Nikhil hasn't said they returned it" is left out when the borrower isn't on LendShelf. | Browser on Nikhil's loan. |
| Duplicate change-date action | Fixed | The banner no longer offers "Change due date"; the due row's "Change" does it. | Browser and unit test. |
| Invite text has no link | Skipped | Blocked on H1 (stable download URL). | n/a |
| Name screen copy | Fixed | "People see this on your requests until they save your number. Friends who have your number see the name they saved." | Code review. |
| Returning user copy (E1) | Skipped | Telling a returning user on a new device apart from a new one isn't a cheap change. | n/a |
| Add confirm layout | Fixed | The collection picker shows only when there's more than one collection; Format and Language sit behind "Format and language (optional)" (E8). | Typecheck and lint; not clicked in the browser. |
| Viewer copy page shows the ISBN | Skipped | Backlog G15, as the QA noted. | n/a |
| Covers as grey boxes | Fixed | The title placeholder now sits under the image, so a slow or missing cover shows the title instead of an empty box. | Browser (Harry Potter, Dune). |

### Left open

- B6: buttons aren't disabled while offline.
- B18, the two cards for one book and subtitle merging need a product decision.
- Not clicked in the browser: B15 Decline all, B17 discard confirm, the Add confirm layout and B21. They are checked by typecheck and lint only.
- Still needs the device pass: push, camera, address book, TalkBack and 200 % font.
- After a reseed, a browser tab that stayed signed in can land on "What's your name?" until it reloads, because the seed wipes Auth under the open session. This is test tooling only.
