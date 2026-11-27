# Feature map

This is a one-row-per-feature index of LendShelf: which flow it belongs to, which screens and files implement it, which Cloud Functions and Firestore collections it uses, and whether it is built. Status was checked against the code on 2026-11-27, not taken from the older docs. The two lists at the end compare the code with the UX spec ([docs/ux/UX-FLOWS.md](../ux/UX-FLOWS.md)).

Flow IDs (F1 to F15) match [USER-FLOWS.md](USER-FLOWS.md), where each flow is described step by step. Tests for each feature are listed in [TEST-MAP.md](TEST-MAP.md); the architecture and data model are in [ARCHITECTURE.md](ARCHITECTURE.md) and [CORE-LOGIC.md](CORE-LOGIC.md).

## How to read the tables

| Status | Meaning |
|---|---|
| done | Built and reachable in the app. "Not verified on a device" in Notes means it was only checked in tests, on web, or by reading the code. |
| partly | Built, but part of the spec is missing or it can't work yet in a real build. |
| not built | Specified (or planned) but no code exists. |

Paths in the table are relative to the repository root and link to the file. `src/app/(app)` routes are shown by their URL (for example `/loan/[loanId]`). Collection names are Firestore collections; "rules" means [firestore.rules](../../firestore.rules) governs a client write.

Cloud Functions in [functions/src/index.ts](../../functions/src/index.ts) (19 in total): callables `completeProfile`, `syncContacts`, `resolveBook`, `setShelfVisibility`, `deleteShelf`, `requestLoan`, `respondToRequest`, `cancelRequest`, `recordLoan`, `markReturned`, `confirmReturn`, `markNotReturned`, `updateDueDate`, `registerPushToken`, `unregisterPushToken`, `deleteAccount`; triggers `onUserCreated` (Auth), `onItemWritten` (Firestore); schedule `dailyMaintenance`.

## Sign-in and onboarding

| Feature | Flow | Screens / routes | Main client files | Cloud Functions / collections | Status | Notes |
|---|---|---|---|---|---|---|
| Phone number sign-in with SMS code | F1 | `/phone`, `/code` | [phone.tsx](<../../src/app/(auth)/phone.tsx>), [code.tsx](<../../src/app/(auth)/code.tsx>), [phone-auth.ts](../../src/stores/phone-auth.ts), [lib/firebase](../../src/lib/firebase) | Firebase Auth | done | Works on dev with the test numbers +91 90000 00001 to 05. Prod sign-in needs the release SHA keys (README "Going live"). Real SMS never tested. |
| Account bootstrap (user doc, phone index, default collection) | F1 | none (server) | none | `onUserCreated`, `completeProfile` fallback; `users`, `phoneIndex`, `shelves` | done | Default collection id `default_<uid>`, stored name "My books". |
| Your name | F1 | `/name` | [name.tsx](<../../src/app/(onboarding)/name.tsx>) | `completeProfile`; `profiles` | done | Max 60 characters. |
| Auth gate and onboarding order | F1 | root stack | [_layout.tsx](../../src/app/_layout.tsx), [session.ts](../../src/stores/session.ts), [contacts store](../../src/stores/contacts.ts) | none | done | Contacts step is remembered per user per device. |
| Keep a deep link or push target through sign-in | F1, F12 | root stack | [use-pending-href.ts](../../src/hooks/use-pending-href.ts), [notification-routes.ts](../../src/lib/notification-routes.ts) | none | done | Checked on web (QA-V1.1 C3) and phone (QA-ANDROID deep links). |
| Find your people (permission, first sync, result on screen) | F1 | `/contacts` | [contacts.tsx](../../src/app/contacts.tsx), [first-run.ts](../../src/features/first-run/first-run.ts), [use-manual-sync.tsx](../../src/features/contacts/use-manual-sync.tsx) | `syncContacts`; `links`, `phoneIndex`, `profiles`, `rateLimits` | done | Three cases: none found, people found, contacts off. |
| Contacts off → Open Settings → sync on return | F1 | `/contacts`, Home | [use-auto-resync.ts](../../src/features/contacts/use-auto-resync.ts) | `syncContacts` | done | Verified on Pixel (QA-ANDROID re-test). |
| Home setup card (3 steps) | F1 | Home | [setup-card.tsx](../../src/features/home/setup-card.tsx), [home.ts](../../src/features/home/home.ts) | `profiles` (pickup note) | done | Open question B18 (QA-V1.1): whether "Find your people" is ticked after a sync with 0 matches. |
| Web contacts typed by hand | F1, F13 | `/contacts` | [contacts.web.ts](../../src/lib/contacts.web.ts), [contacts store](../../src/stores/contacts.ts) | `syncContacts` | done | Web is a development build only. |
| "Welcome back" copy for a returning user on a new phone | F1 | `/contacts` | none | none | not built | UX-FLOWS E1; skipped in QA-V1.1 as not cheap. |

## Discovery

| Feature | Flow | Screens / routes | Main client files | Cloud Functions / collections | Status | Notes |
|---|---|---|---|---|---|---|
| Home feed: Your circle, From your wishlist, New this week, Available to borrow, Popular | F2 | Home | [index.tsx](<../../src/app/(app)/(tabs)/index.tsx>), [DiscoverHome.tsx](../../src/features/discover/DiscoverHome.tsx), [highlights.ts](../../src/features/discover/highlights.ts), [use-items.ts](../../src/hooks/use-items.ts) | reads `links`, `items` (one query per linked owner), `profiles`, `watches` | done | Popular hidden below 3 entries; Available excludes books I own. |
| Circle search ("Does anyone have…?") with edition grouping | F2 | Home | [search.ts](../../src/lib/search.ts), [availability.ts](../../src/features/wishlist/availability.ts) | none (on device) | done | Copies under different catalogue records with the same title and first author show as "n editions". Subtitle variants are not merged. |
| Catalogue fallback search | F2, F11 | Home | [CatalogueResults.tsx](../../src/features/discover/CatalogueResults.tsx), [catalogue.ts](../../src/features/discover/catalogue.ts), [use-catalogue-search.ts](../../src/features/discover/use-catalogue-search.ts) | Open Library from the device; `resolveBook` on tap; `works`, `isbnIndex` | done | Heart adds to the wishlist. |
| Book page with "Who has it" first, other editions merged | F2 | `/book/[workId]` | [book/[workId].tsx](<../../src/app/(app)/book/[workId].tsx>), [CircleCopiesList.tsx](../../src/features/book/CircleCopiesList.tsx), [circle-copies.ts](../../src/features/book/circle-copies.ts) | reads `works`, `items`, `reviews` | done | Wishlist toggle hidden when I own a copy. |
| Person page | F2 | `/person/[uid]` | [person/[uid].tsx](<../../src/app/(app)/person/[uid].tsx>), [group-by-shelf.ts](../../src/features/person/group-by-shelf.ts) | reads `shelves`, `items`, `profiles`, `links` | partly | "Nudge `<name>`" for someone who shares nothing (UX-FLOWS E2) not built. |
| Copy page, viewer side | F2, F3 | `/copy/[itemId]` | [copy/[itemId].tsx](<../../src/app/(app)/copy/[itemId].tsx>), [ViewerPanel.tsx](../../src/features/copy/ViewerPanel.tsx), [copy-actions.ts](../../src/features/copy/copy-actions.ts) | reads `items`, `profiles`, `loans`, `watches` | done | Viewers still see the ISBN (UX-FLOWS G15 backlog). |
| "This copy isn't shared any more" fallback | F2, F9 | `/copy/[itemId]` | [copy/[itemId].tsx](<../../src/app/(app)/copy/[itemId].tsx>) | none | done | Verified live on two phones (S8). |
| Home status strip | F5, F6 | Home | [status-strip.tsx](../../src/features/home/status-strip.tsx), [home.ts](../../src/features/home/home.ts) | reads `loans` | done | |

## Loans

| Feature | Flow | Screens / routes | Main client files | Cloud Functions / collections | Status | Notes |
|---|---|---|---|---|---|---|
| Ask to borrow, then WhatsApp opens | F3 | Ask sheet on Home, Book, Copy | [AskDialog.tsx](../../src/features/copy/AskDialog.tsx), [whatsapp.ts](../../src/lib/whatsapp.ts), [loans messages](../../src/features/loans/messages.ts) | `requestLoan`; `loans`, `links`, `items`, `profiles`, `users` | done | Retry after `already-exists` opens the existing request. |
| "Request sent" receipts and "Message again" | F3 | Home, Copy, Loan | [DiscoverHome.tsx](../../src/features/discover/DiscoverHome.tsx), [ViewerPanel.tsx](../../src/features/copy/ViewerPanel.tsx) | reads `loans` | done | QA-V1.1 B4 fix. |
| Cancel a request | F3 | Copy, Loan | [loan-sheets.tsx](../../src/features/loans/loan-sheets.tsx), [ViewerPanel.tsx](../../src/features/copy/ViewerPanel.tsx) | `cancelRequest`; `loans` | done | |
| Two requests for one book (borrower warning and "Cancel the other request?") | F3, F4 | Ask sheet, Needs you | [requests.ts](../../src/features/loans/requests.ts), [needs-you.ts](../../src/features/loans/needs-you.ts) | reads `loans` | done | UX-FLOWS R14. |
| Needs-you cards and the Loans badge | F4, F5, F6 | Home (2 cards), Loans (all) | [needs-you.ts](../../src/features/loans/needs-you.ts), [needs-you-card.tsx](../../src/features/loans/needs-you-card.tsx), [use-needs-you.ts](../../src/features/loans/use-needs-you.ts), [needs-you.tsx](../../src/features/home/needs-you.tsx), [(tabs)/_layout.tsx](<../../src/app/(app)/(tabs)/_layout.tsx>) | reads `loans` | done | Badge = number of cards. |
| Accept with due date, pickup prompt and success sheet | F4 | Due-date sheet | [loan-sheets.tsx](../../src/features/loans/loan-sheets.tsx), [due-date-dialog.tsx](../../src/features/loans/due-date-dialog.tsx), [due-dates.ts](../../src/features/loans/due-dates.ts) | `respondToRequest`; `loans`, `items`, `watches`; `completeProfile` for the pickup note | done | Default 3 weeks. |
| Decline with a reason, "Also stop lending this copy" | F4 | Decline sheet | [loan-sheets.tsx](../../src/features/loans/loan-sheets.tsx), [requests.ts](../../src/features/loans/requests.ts) | `respondToRequest` (reason); `loans`, `watches`; `items` (client, for stop lending) | done | |
| Competing requests: grouped card, chooser, Decline all | F4 | Needs you, chooser sheet | [needs-you-card.tsx](../../src/features/loans/needs-you-card.tsx) | `respondToRequest` | done | Decline all was checked by typecheck only in QA-V1.1; not clicked since. |
| Auto-decline other requests as "lent to someone else" with a back-watch | F4, F7 | none (server) | none | `respondToRequest`, `recordLoan`; `loans`, `watches` | done | |
| Loan screen (banner, other party, due row, timeline, review) | F3 to F7 | `/loan/[loanId]` | [loan/[loanId].tsx](<../../src/app/(app)/loan/[loanId].tsx>), [loan-view.ts](../../src/features/loans/loan-view.ts), [use-loan-people.ts](../../src/features/loans/use-loan-people.ts), [use-loans.ts](../../src/hooks/use-loans.ts) | reads `loans`, `items`, `reviews`, `watches` | done | "This isn't shared with you any more" for loans you aren't part of. |
| Pick-up window wording and "Not collected? Close this loan" | F5 | Loan, cards, rows | [needs-you.ts](../../src/features/loans/needs-you.ts) (`inPickupWindow`), [loan-view.ts](../../src/features/loans/loan-view.ts) | `confirmReturn` (reason `notCollected`); `loans`, `items`, `watches` | done | Window is time-based (48 h), not a status. |
| I've returned it / Got it back / Not back yet | F5 | Cards, Loan, Loans rows, Copy | [loan-sheets.tsx](../../src/features/loans/loan-sheets.tsx), [OwnerPanel.tsx](../../src/features/copy/OwnerPanel.tsx) | `markReturned`, `confirmReturn`, `markNotReturned`; `loans`, `items`, `watches` | done | `returnEvents` keeps every return and "not back yet" for the timeline. |
| Change due date and tell the borrower | F5 | Loan due row, overdue card | [loan-sheets.tsx](../../src/features/loans/loan-sheets.tsx), [due-dates.ts](../../src/features/loans/due-dates.ts) | `updateDueDate`; `loans`, `items` | done | Chips +1 week / +2 weeks / +1 month. |
| Request expiry and due/overdue reminders | F6 | none (scheduled) | none | `dailyMaintenance`; `loans`, `links` | done | Due soon the day before; overdue the day after, then weekly. SPEC says "due in 2 days". |
| Nudge on WhatsApp / Ask for more time | F6 | Cards, Loan | [loans messages](../../src/features/loans/messages.ts), [whatsapp.ts](../../src/lib/whatsapp.ts) | none | done | Text greets by profile first name. |
| Lend in person (copy picker, borrower picker, success, invite) | F7 | `/pick-copy`, `/lend/[itemId]` | [pick-copy.tsx](<../../src/app/(app)/pick-copy.tsx>), [lend/[itemId].tsx](<../../src/app/(app)/lend/[itemId].tsx>), [borrower-picker.tsx](../../src/features/lend/components/borrower-picker.tsx), [borrowers.ts](../../src/features/lend/borrowers.ts), [due-date-picker.tsx](../../src/features/lend/components/due-date-picker.tsx) | `recordLoan`; `loans`, `items`, `phoneIndex`, `links`, `watches` | done | Returns `onApp` so the success screen doesn't offer an invite to an app user. |
| Loans ledger (Needs you, Out with friends, With you, Your requests, Recent, History) | F4 to F7 | Loans | [loans.tsx](<../../src/app/(app)/(tabs)/loans.tsx>), [buckets.ts](../../src/features/loans/buckets.ts) | reads `loans`, `items`, `watches` | done | Recent = closed in 14 days, max 10. History filter All / Lent / Borrowed / Requests. No pull to refresh (lists are live). |
| Stale actions (sheet closes, plain-word errors) | F4, F5 | All loan sheets | [stale.ts](../../src/features/loans/stale.ts), [errors.ts](../../src/lib/errors.ts) | server `failed-precondition` messages | done | Verified on two phones (S4). |
| Owner left / borrower left states | F15 | Loan, Loans rows | [loan-view.ts](../../src/features/loans/loan-view.ts), [buckets.ts](../../src/features/loans/buckets.ts) | `deleteAccount`; `loans` (`ownerLeft`, `borrowerLeftAt`) | done | |
| Offline handling | F3 to F7 | All actions | [errors.ts](../../src/lib/errors.ts) | none | partly | Plain "You're offline…" / "Can't reach LendShelf…" messages and Retry toasts; buttons aren't disabled while offline (QA-V1.1 B6). |
| Lend screen for a copy that is out: inline Got it back | F7 | `/lend/[itemId]` | none | none | not built | UX-FLOWS G13; the screen says "Mark it returned first" with Close only. |
| Owner reminders for expiring requests and long "says returned" | F6 | none | none | none | not built | UX-FLOWS G36 (backlog). |
| Edit a recorded borrower's name or number | F7 | none | none | none | not built | UX-FLOWS G39 / H12. |
| Lost or damaged book, reopen a closed loan | F5 | none | none | none | not built | UX-FLOWS H7, H10. |

## Library

| Feature | Flow | Screens / routes | Main client files | Cloud Functions / collections | Status | Notes |
|---|---|---|---|---|---|---|
| Add by catalogue search | F8 | `/add` (Search) | [add.tsx](<../../src/app/(app)/add.tsx>), [search-panel.tsx](../../src/features/add/components/search-panel.tsx), [open-library.ts](../../src/features/add/open-library.ts), [use-ol-search.ts](../../src/features/add/use-ol-search.ts) | `resolveBook`; `works`, `isbnIndex`; `items` (client, rules) | done | Exact title and author ranked first, summaries pushed down. |
| Continuous ISBN scanning with a review queue | F8 | `/add` (Scan) | [scan-panel.tsx](../../src/features/add/components/scan-panel.tsx), [barcode-camera.tsx](../../src/features/add/components/barcode-camera.tsx), [scan-queue.ts](../../src/features/add/scan-queue.ts), [isbn.ts](../../src/features/add/isbn.ts) | `resolveBook` (Open Library, Google Books fallback) | done | The live viewfinder opened on a Pixel, but a real barcode scan was never recorded on a device; typed ISBNs were. |
| Add by hand, cover photo, "Is it one of these?" | F8 | `/add` (Type it in) | [manual-panel.tsx](../../src/features/add/components/manual-panel.tsx), [save.ts](../../src/features/add/save.ts) | `works` (custom, client), `items`; Storage `covers/{uid}` | done | Cover upload verified on a phone. |
| Confirm step (collection, who can see it, format, language) and duplicate warning | F8 | `/add` | [confirm-step.tsx](../../src/features/add/components/confirm-step.tsx), [added-step.tsx](../../src/features/add/components/added-step.tsx) | `items` (batched, 19 per batch) | done | Collection and visibility are remembered only while the app runs. |
| Discard confirm on Back (header and Android) | F8 | `/add` | [leave.ts](../../src/features/add/leave.ts) | none | done | |
| Partial save retry ("4 of 6 added") | F8 | `/add` | none | none | not built | UX-FLOWS E8. |
| "Remove from your wishlist?" when adding a wishlisted book | F8, F11 | `/add` | none | none | not built | UX-FLOWS E11. |
| My books grid/list, search, status chips | F9 | My books | [my-books.tsx](<../../src/app/(app)/(tabs)/my-books.tsx>), [library-toolbar.tsx](../../src/features/library/components/library-toolbar.tsx), [copy-card.tsx](../../src/features/library/components/copy-card.tsx), [filter.ts](../../src/features/library/filter.ts) | reads `items`, `shelves` | done | Chips All / Out / Not lending / Hidden. |
| Visibility (Lendable / Not lending / Hidden) with pending-request sheets | F9 | Copy (owner) | [OwnerPanel.tsx](../../src/features/copy/OwnerPanel.tsx), [visibility-copy.ts](../../src/features/copy/visibility-copy.ts), [pending-requests.ts](../../src/features/shelves/pending-requests.ts), [pending-requests-sheet.tsx](../../src/features/shelves/components/pending-requests-sheet.tsx) | `respondToRequest` (decline `notLending`); `items` (client, rules) | done | Declines run on the client before the change. |
| Collections: create, rename, reorder, public/private, delete with move | F9 | `/shelves` | [shelves.tsx](<../../src/app/(app)/shelves.tsx>), [shelf-dialogs.tsx](../../src/features/shelves/components/shelf-dialogs.tsx), [actions.ts](../../src/features/shelves/actions.ts), [logic.ts](../../src/features/shelves/logic.ts) | `setShelfVisibility`, `deleteShelf`; `shelves`, `items` | done | Deleting into a private collection names and declines pending requests (QA two-phone bug E fix). |
| Default collection shown as "Main shelf" | F9 | My books, Add, Copy | [filter.ts](../../src/features/library/filter.ts) | `shelves` | partly | Display only. Renaming the stored default for new users (UX-FLOWS G37) not built. |
| Collapse collection UI until a second collection exists | F9 | My books | none | none | partly | Only the Add confirm step hides the collection picker with one collection; My books still shows the chip row (UX-FLOWS G16). |
| Edit edition (format, language) | F9 | Copy (owner) | [EditEditionDialog.tsx](../../src/features/copy/EditEditionDialog.tsx), [edition.ts](../../src/features/copy/edition.ts) | `items` (client) | done | |
| Delete a copy (requests cancelled by the server) | F9 | Copy (owner) | [OwnerPanel.tsx](../../src/features/copy/OwnerPanel.tsx), [mutations.ts](../../src/features/shared/mutations.ts) | `onItemWritten`; `items`, `loans` (`closedReason: copyRemoved`) | done | Blocked while the copy is out (rules and UI). |
| Server-side decline when a copy is hidden or made private | F9 | none | none | none | not built | UX-FLOWS G34; the client sequence is used instead. |
| Upgrade a custom book to a catalogue book | F8 | none | none | none | not built | Out of scope for v1 (SPEC §7). |

## Social

| Feature | Flow | Screens / routes | Main client files | Cloud Functions / collections | Status | Notes |
|---|---|---|---|---|---|---|
| One-way contact matching, names you saved | F1, F13 | Everywhere | [use-links.ts](../../src/hooks/use-links.ts), [people.ts](../../src/features/shared/people.ts), [profiles store](../../src/stores/profiles.ts) | `syncContacts`; `links`, rules | done | Short names never cut "Dr. Mehta" to "Dr.". |
| Automatic re-sync on foreground (24 h) with the shrink guard | F13 | none | [use-auto-resync.ts](../../src/features/contacts/use-auto-resync.ts), [resync.ts](../../src/features/contacts/resync.ts), [session-bootstrap.tsx](../../src/components/session-bootstrap.tsx) | `syncContacts` (never `replace`); `links`, `rateLimits` | done | The 24 h automatic run was never observed on a device. |
| "Sync anyway" sheet (Keep everyone / Remove them) | F13 | Me, `/contacts` | [use-manual-sync.tsx](../../src/features/contacts/use-manual-sync.tsx) | `syncContacts` with `replace: true` | done | Verified on phones (S0). |
| "New on LendShelf" chip | F2, F13 | Home | [DiscoverHome.tsx](../../src/features/discover/DiscoverHome.tsx) | reads `links` | done | Not verified on a device. |
| Invite friends (share sheet) | F1, F13 | Contacts result, Home, Me, Lent screen, Loans empty | [invite-text.ts](../../src/features/invite/invite-text.ts), [share-invite.ts](../../src/features/invite/share-invite.ts), [use-invite.ts](../../src/features/invite/use-invite.ts) | none | partly | No download link yet (UX-FLOWS H1); text says "Ask me for the app link" until `EXPO_PUBLIC_INVITE_URL` is set. |
| "Not in your contacts · `<number>`" cue on requests | F4 | Cards, chooser, Loan | [use-loan-people.ts](../../src/features/loans/use-loan-people.ts) | reads `links` | done | |
| Reviews (write, edit, delete, see your circle's) | F10 | `/review/[workId]`, Book, Copy, Loan | [review/[workId].tsx](<../../src/app/(app)/review/[workId].tsx>), [ReviewList.tsx](../../src/features/reviews/ReviewList.tsx), [review-logic.ts](../../src/features/reviews/review-logic.ts), [use-reviews.ts](../../src/hooks/use-reviews.ts) | `reviews` (client, rules) | done | Average computed on the device. |
| "How was it?" on the closed loan | F10 | `/loan/[loanId]` | [loan/[loanId].tsx](<../../src/app/(app)/loan/[loanId].tsx>) | `reviews` | done | Opens the review with the tapped rating. |
| Wishlist and the wishlist push | F11 | Book, Home, `/wishlist` | [wishlist.tsx](<../../src/app/(app)/wishlist.tsx>), [mutations.ts](../../src/features/shared/mutations.ts), [availability.ts](../../src/features/wishlist/availability.ts) | `watches` (client); `onItemWritten` push | done | Push never delivered (no EAS project). |
| Notify me when it's back (manual and server-made) | F11 | Copy, Loan, `/wishlist` | [ViewerPanel.tsx](../../src/features/copy/ViewerPanel.tsx), [mutations.ts](../../src/features/shared/mutations.ts) | `watches`; `confirmReturn`, `respondToRequest`, `recordLoan` | done | All back-watches on a copy are deleted when it comes back. |

## Settings and account

| Feature | Flow | Screens / routes | Main client files | Cloud Functions / collections | Status | Notes |
|---|---|---|---|---|---|---|
| Notification pre-prompt in context | F12 | Dialog after request, accept, lend, wishlist add | [ask.ts](../../src/features/push-ask/ask.ts), [decision.ts](../../src/features/push-ask/decision.ts), [push-ask-dialog.tsx](../../src/features/push-ask/push-ask-dialog.tsx) | none | done | Verified on two phones (S19), including Android 13+ "denied but can ask" handling. |
| Push token registration | F12 | Silent on start, Me row | [push.ts](../../src/lib/push.ts), [use-push-registration.ts](../../src/features/me/use-push-registration.ts) | `registerPushToken`, `unregisterPushToken`; `users.pushTokens` | partly | Skipped until the app has an EAS project id; no token has ever been stored. |
| Push sending and tap routing | F12 | All detail screens | [notification-routes.ts](../../src/lib/notification-routes.ts), [use-notification-routing.ts](../../src/hooks/use-notification-routing.ts) | [functions/src/lib/push.ts](../../functions/src/lib/push.ts), [messages.ts](../../functions/src/lib/messages.ts) | partly | Server sends and logs "Push skipped: no tokens"; routing was tested with deep links, not real pushes. |
| Foreground in-app banner, app-icon badge | F12 | none | none | none | not built | Foreground pushes use the system banner; no icon badge (deliberate, UX-FLOWS F5). |
| Me › Push notifications row | F12 | Me | [notifications-section.tsx](../../src/features/me/notifications-section.tsx), [push-permission.ts](../../src/lib/push-permission.ts) | none | done | |
| Profile name and pickup note | F13 | Me, setup card, accept sheet | [edit-profile-dialog.tsx](../../src/features/me/edit-profile-dialog.tsx), [me.tsx](<../../src/app/(app)/(tabs)/me.tsx>) | `completeProfile`; `profiles` | done | Pickup note max 200 characters. |
| Contacts row and Sync now | F13 | Me, `/contacts` | [me.tsx](<../../src/app/(app)/(tabs)/me.tsx>), [contacts.tsx](../../src/app/contacts.tsx) | `syncContacts` | done | |
| Appearance (light, dark, system) | F13 | Me | [theme store](../../src/stores/theme.ts), [use-color-scheme.ts](../../src/hooks/use-color-scheme.ts) | none | done | Not one of the numbered flows; listed under Me. |
| Privacy policy screen | F15 | `/privacy` | [privacy.tsx](<../../src/app/(app)/privacy.tsx>) | none | done | README says to review it before wider release. |
| Export CSV / JSON | F14 | Me, delete pre-check | [export-dialog.tsx](../../src/features/export/export-dialog.tsx), [assemble.ts](../../src/features/export/assemble.ts), [fetch.ts](../../src/features/export/fetch.ts), [export.ts](../../src/lib/export.ts) | reads `items`, `shelves`, `loans`, `reviews` | done | Share sheet verified on a phone; web downloads. |
| Sign out | F15 | Me, name screen | [account.ts](../../src/features/me/account.ts), [session.ts](../../src/stores/session.ts) | `unregisterPushToken` | done | |
| Delete account with pre-check | F15 | Me | [delete-account-dialog.tsx](../../src/features/me/delete-account-dialog.tsx), [delete-precheck.ts](../../src/features/me/delete-precheck.ts) | `deleteAccount`; every collection, Storage, Auth | done | |
| App Check | none | none | none | `ENFORCE_APP_CHECK` (off) | not built | The app has no App Check provider; every callable logs a token warning. |
| Accessibility (48 dp targets, labels, 200 % font, TalkBack) | all | all | [a11y.ts](../../src/lib/a11y.ts) and labels across screens | none | partly | Labels and announcements are in code; TalkBack and 200 % font never tested on a device. |
| iOS build | all | all | [app.config.ts](../../app.config.ts) | none | not built | Never built or run (no Mac, no Apple account set up). |

## Specified in UX-FLOWS.md but not built

| Spec item | Where in the spec | What the code does instead |
|---|---|---|
| "Welcome back. Re-check your contacts on this phone" for a returning user | E1 edge cases | The normal Find your people screen. |
| "Nudge `<name>`" on a Person page of someone who shares nothing | E2 edge cases | "No shared books yet" with no button. |
| Invite download link | E2, H1 | "Ask me for the app link" until `EXPO_PUBLIC_INVITE_URL` is set. |
| Ask disabled with "You're offline" | E3, E4 failure exits | A toast after the call fails. |
| Viewer Edition card collapsed, no ISBN | D4 Copy page viewer, G15 | Format, language and ISBN shown to everyone. |
| Lend screen "Already with `<name>`" with inline Got it back | E7, G13 | "Already lent out … Mark it returned first" with Close. |
| Edit a recorded loan's borrower | E7, G39, H12 | Not possible. |
| "4 of 6 added. Retry the other 2" on a partial batch failure | E8 failure exits | One error toast; earlier batches stay saved. |
| Visibility remembered between sessions | E8 step 2 | Remembered only while the app runs. |
| "Remove `<title>` from your wishlist?" when adding a wishlisted book | E11 edge cases | No prompt; the wishlist entry stays. |
| In-app banner for foreground pushes | E12 | The system banner. |
| Server trigger that declines requests when a copy is hidden or made private | E9 edge cases, G34 | Client declines first, then changes visibility. |
| Collections hidden until a second one exists | D4 My books, G16 | Chip row always shown; only the Add confirm step hides the picker. |
| Default collection renamed for new users | G37 | Stored as "My books", displayed as "Main shelf". |
| Owner reminders when a request is about to expire or "says returned" sits for 3 days | E4 table, G36 | None. |
| Single due-date picker for Accept, Change and Lend | G17 | Two components: chips plus stepper in sheets, chips plus calendar on Lend. |
| Per-tab navigation stacks | F1, G21 | Deferred by the spec itself; detail screens hide the tab bar. |
| Lost / damaged reason, reopen a loan, "While you were away", number change, households | E16, H7 to H10 | Backlog or open questions. |
| TalkBack and 200 % font device pass | F8, C14 | Not run. |

## Built but not in the spec

These came from QA fixes or implementation choices and are not described in UX-FLOWS.md or SPEC.md (or SPEC.md lists them differently).

| What | Where | Why |
|---|---|---|
| Extra loan fields `notBackYetAt`, `returnEvents`, `dueChangedAt`, `firstDueDate`, `borrowerLeftAt`, and `closedReason: copyRemoved` | [functions/src/model.ts](../../functions/src/model.ts), [loans.ts](../../functions/src/handlers/loans.ts), [account.ts](../../functions/src/handlers/account.ts), [triggers.ts](../../functions/src/handlers/triggers.ts) | QA-V1.1 B1, B9, B13, B16 and QA-ANDROID #10. SPEC §3 lists none of them. |
| `recordLoan` returns `onApp` | [loans.ts](../../functions/src/handlers/loans.ts) | QA two-phone bug F; SPEC §5 says it returns only `loanId`. |
| Borrower "hasn't got it back yet" card (3 days) and banner | [needs-you.ts](../../src/features/loans/needs-you.ts), [loan-view.ts](../../src/features/loans/loan-view.ts) | QA-V1.1 B1. |
| Borrower can say "I've returned it" during the pick-up window; the window ends once a return is recorded | [loan-view.ts](../../src/features/loans/loan-view.ts), [needs-you.ts](../../src/features/loans/needs-you.ts) | QA-ANDROID #6 and Pixel bug B. |
| Two-requester card with "Lend to A" / "Lend to B" buttons | [needs-you-card.tsx](../../src/features/loans/needs-you-card.tsx) | QA-V1.1 C4 tap count. |
| Requests past 7 days shown as expired before the daily job runs | [loan-view.ts](../../src/features/loans/loan-view.ts), [needs-you.ts](../../src/features/loans/needs-you.ts) | QA-V1.1 B14. |
| "It's back on `<owner>`'s shelf" with Ask again after a "lent to someone else" decline | [loan-view.ts](../../src/features/loans/loan-view.ts) | QA-V1.1 B12. |
| Named confirm when deleting a collection into a private one | [pending-requests.ts](../../src/features/shelves/pending-requests.ts) `deleteToPrivateSheet` | QA two-phone bug E. |
| Due-date move earlier gets its own WhatsApp text ("Could I have … back by …?") | [loans messages](../../src/features/loans/messages.ts) | QA-V1.1 friction. |
| Date-only due dates stored as noon India time; reminders by India calendar day | [functions/src/lib/loans.ts](../../functions/src/lib/loans.ts) | QA-ANDROID bug D and overdue timing fix. |
| Separate "catalogue isn't responding" error | [errors.ts](../../src/lib/errors.ts) | QA-ANDROID Pixel bug C. |
| "Checking this phone…" after 4 s on Send code | [phone.tsx](<../../src/app/(auth)/phone.tsx>) | Pixel re-test. |
| Wishlist add also triggers the push pre-prompt | [mutations.ts](../../src/features/shared/mutations.ts) | In UX-FLOWS E1 as a trigger, but not in SPEC. |
| Lazy loading of each Cloud Function (`FUNCTION_TARGET`) | [functions/src/index.ts](../../functions/src/index.ts) | Faster cold starts (commit a85e8cf); not user-facing. |
