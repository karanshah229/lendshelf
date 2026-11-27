# LendShelf decisions and assumptions

This page collects the architecture decisions behind LendShelf, the assumptions the build makes about its users and surroundings, and what is still open before going live. It consolidates [DECISIONS.md](../../DECISIONS.md), the Decision log in [UX-FLOWS.md](../ux/UX-FLOWS.md#decision-log), [SPEC.md](../../SPEC.md) §1 and what the code shows, and links back to them rather than repeating them.

Where an older document and the code disagree, the code wins; those differences are listed in the [last section](#older-docs-that-disagree-with-the-code).

## Architecture decisions

"Dn" points to a row of [DECISIONS.md](../../DECISIONS.md); "Rn", "Bn", "Cn", "Gn" and "Hn" point to [UX-FLOWS.md](../ux/UX-FLOWS.md) and [UX-REVIEW.md](../ux/UX-REVIEW.md). "Not recorded" means the docs don't name an alternative.

### Platform and stack

| Decision | Why | Alternatives considered | Consequences | Source |
|---|---|---|---|---|
| One Expo codebase (SDK 58, Expo Router, TypeScript strict) for Android and iOS; web build for development only | One team, two platforms; web is the fastest test loop | Not recorded | Native modules need a dev build, not Expo Go; web lacks address book, push and camera, so it has stand-ins (manual contacts) | SPEC §1-2 |
| NativeWind + React Native Reusables (shadcn-style) | Familiar component model, light and dark themes | Not recorded | NativeWind quirks caused a Loans crash fix in `afc2272` | SPEC §2 |
| React Native Firebase on native, Firebase JS SDK on web, behind one `@/lib/firebase` module | Phone sign-in on native needs RNFirebase | One SDK everywhere | Two files must export the same names; a type check enforces it | D2 |
| Continuous Native Generation (`android/`, `ios/` generated, not committed) | Native config lives in `app.config.ts` | Committed native folders | Re-run prebuild when switching environment; Windows build needs a newer CMake | README "Android build" |
| zustand stores, Firestore listeners in hooks, pure logic files with unit tests | Logic testable without Firebase | Not recorded | Most rules in [CORE-LOGIC.md](CORE-LOGIC.md) have a pure function and a test | Code |

### Backend shape

| Decision | Why | Alternatives considered | Consequences | Source |
|---|---|---|---|---|
| Firebase (Auth, Firestore, Cloud Functions, Storage) as the whole backend | Phone auth, live listeners and rules out of the box | Not recorded | Vendor lock-in; Blaze plan needed for functions | SPEC §2 |
| Clients read Firestore directly under rules; writes that affect other people go through callable functions | Loan state touches two users and an item; doing it server-side keeps both sides consistent and rules simple | Client writes with rules only | 16 callables; latency of a callable (a few seconds on a cold instance) on every loan action | D3, D4 |
| Keep Cloud Functions rather than move their logic into the client | Contact matching reads `phoneIndex`, which clients can't read; client-side matching would let anyone test which numbers are on the app. Same cost either way | Move logic to the client to drop functions | Functions stay in the deploy and the bill (near zero at this scale) | D42 |
| Shelf visibility and shelf deletion are callables | They recompute `sharedWithContacts` on up to hundreds of copies atomically | Client batch | 480-copy limit per collection operation | D4 |
| `sharedWithContacts` stored on each copy and checked by rules | Lets contacts query `ownerId == X && sharedWithContacts == true`, which rules can prove | Rules that read the shelf on every read (can't filter a list query) | Every visibility change must keep it consistent | SPEC §3, rules |
| Reviews read by document id, profiles readable by id only | Rules can't filter a list by "author is in my contacts"; listing profiles would let anyone enumerate users | List queries | One read per linked person per Book page | D5, D18 |
| Server-set loan states (`notCollected`, `notBackYet`, `lentToSomeoneElse`, `ownerLeft`) | Client guesses sent wrong pushes and left the two sides seeing different states | "Zero backend" client workarounds (device flags, delayed undo, guessed reasons) | Backend bundle B1-B6; both sides always read the same state | UX-REVIEW verdict, R3, R9, R10, B2-B5 |
| Pick-up window is time-based wording (48 h), not a state | Avoids a new status, callable and reminder logic | An `accepted` state with "Handed over" (G38, dropped) | Due date starts at accept; owner closes uncollected loans with `notCollected` | R3, G38 |
| No undo; one-step confirm sheets | A delayed call is lost when WhatsApp backgrounds the app; short undo fails screen-reader users | Timed undo (6 s delayed call) | A mistaken close can't be reopened (H10) | R8, F3 |
| Hiding or making private declines pending requests on the client first | Nobody is left with "Copy not found" | Server trigger on visibility change (G34, backlog) | If the app dies between the two steps, requests are declined and the copy is still visible (safe; user retries) | R11, E9 |
| Requests expire after 7 days; default loan 21 days; due date today to +1 year | Gentle defaults; prevents stale accepts and nonsense dates | Not recorded | Daily expiry job; client mirrors the 7 days | D12 |
| Reminders by calendar day in India time; date-only due dates stored as noon IST | Reading date-only values as UTC midnight sent Overdue on the due day and Due soon two days early | Hour-based windows (the original 24-48 h rule) | Loans saved before the fix keep 05:30 IST due times | QA-ANDROID bug D, `b61b841`, `de15c0b` |
| `syncContacts` limited to 20 calls per user per rolling 24 h | Slows phone-number probing | No limit | Auto re-sync uses 1 of 20 calls a day | D24 |
| Shrink guard on the server, not a client heuristic | A half-restored address book could wipe the circle | Client contact-count check | `replace: true` only after the user confirms | R6, B1 |
| Borrower pushes about owner-recorded loans only if the borrower has the owner saved | `recordLoan` accepts any number; otherwise anyone could push chosen text to any user | Push always | A borrower who hasn't saved the owner sees the loan only in-app | D23 |
| Cold starts handled with lazy loading, `FUNCTION_TARGET` and `preferRest` | Faster start-up without paying for idle instances | `minInstances` (billed idle time); more CPU (barely helps module loading) | New functions must be added to `FUNCTION_NAMES`; start-up about 2.4 s to 1.7 s | PROGRESS workstream 12, functions/README "Cold starts" |
| App Check enforcement is an env opt-in, off | Emulators and current builds have no App Check | Enforce now | Must be turned on before production | D25 |

### Product rules that shape the code

| Decision | Why | Alternatives considered | Consequences | Source |
|---|---|---|---|---|
| One-way contact matching | No friend requests, fits family and friends | Mutual friend requests | Cold start is harder ("why can't I see them?"); mitigated by invites that say "save my number" | SPEC §1, UX-FLOWS §H |
| WhatsApp deep links instead of in-app chat | It's where these people already talk | In-app chat | The app can't know whether a message was sent; every state change also offers a WhatsApp button | SPEC §1, F7 |
| Expo push service | One token type for Android and iOS; no FCM/APNs server code | FCM/APNs directly | Delivery needs EAS credentials (not set up yet) | D6 |
| Home is the discovery feed with up to 2 Needs-you cards; 4 tabs; one badge, on Loans | Modelled about 30 fewer taps per 100 opens than a dashboard Home | Needs-you dashboard + Circle tab; app-icon badge | No app-icon badge in v1.1 | UX-FLOWS §D1, R7, R13, R23 |
| A Loan screen for every loan, opened by every loan push | One notification, one screen, one timeline | Loans only as rows | `/loan/[loanId]` route; timeline fields on loans | UX-FLOWS §D4 |
| Saved contact name on screen, profile first name in WhatsApp greetings | Greeting a friend by a saved nickname ("Hi Dr.!") reads badly | Saved name everywhere | Two name sources per person | SPEC §1, R21 |
| Short names fall back to the full name when two people would collide | Two contacts both showed as the same first word | First word always | Labels can be long for some contact names | QA-ANDROID bug 4 |
| Custom books private to their creator; catalogue works created only by `resolveBook`; `isbnIndex` cache | Keeps catalogue records trustworthy; repeat scans need no network | Shared custom books | Duplicate custom books can't be merged yet | D11, D19, D22, SPEC §1 |
| Copies written 19 per batch | Firestore allows 20 document reads per batched write | One batch | A failure part-way keeps the earlier copies | D31 |
| Sign-out doesn't clear Firestore's offline cache | Native can only clear after terminating the shared instance | Clear on sign-out | Revisit with a clear on next cold start | D29 |

### Environments and operations (decided in the 21-27 Nov sessions)

| Decision | Why | Alternatives considered | Consequences | Source |
|---|---|---|---|---|
| Real Firebase projects `lendshelf-dev` and `lendshelf-prod`, picked at build time by `APP_ENV`; dev is the default, prod never implicit | One way to run the app; no emulator-only code or permissions ship | Emulator mode in the app | Configs are git-ignored and downloaded; dev data is real data | D38 |
| Emulator kept only for backend tests (`firebase.test.json`, project `demo-lendshelf`) | Rules and integration tests need a backend they can wipe; a `demo-` id can't reach a real project | Test against dev | Tests need Java 21+ | D39 |
| Demo seed data dropped; dev starts empty | The seed wrote to the emulator the app no longer uses | Seed dev | Test accounts are made by signing in with test numbers | D40 |
| Blaze plan, free features preferred | Cloud Functions require Blaze; the expected bill is near zero | Spark plan without functions | Budget alerts recommended; `maxInstances: 10` caps spikes | functions/README "Budget alert" |
| Cloud Storage kept, for covers of hand-entered books | Users need a cover for books the catalogues don't have | No custom covers | Storage rules and deletion on account delete | SPEC §2 |
| Storage bucket in `us-central1`; Firestore and functions in `asia-south1` | The Storage free tier covers US regions only; covers are small and cached | Bucket in `asia-south1` (billed from the first byte) | Slightly slower first cover load | D41, D7 |
| SMS sign-in limited to India | Users are in India; limits SMS abuse and cost | All regions | Numbers outside India can't sign in | README "Going live" (console setting) |
| Dev test phone numbers +91 90000 00001 to 05, none on prod | Sign in without SMS for testing | Real SMS on dev | The code is kept outside the repo | README, HANDOFF |
| One EAS project with two app ids: `com.lendshelf.app.dev` (dev builds) and `com.lendshelf.app` (prod) | EAS stores push credentials per app id; one project id keeps all Expo tokens in one project; both apps can be installed | Separate EAS projects | The dev id must be registered in `lendshelf-dev`; local builds keep `com.lendshelf.app` unless `APP_ID` is set | README "Push notifications setup", [app.config.ts:24](../../app.config.ts#L24) |

## Assumptions

"Checked" means a test, QA run or the code confirms it; "unchecked" means the build relies on it without evidence yet.

| Assumption | Status | Evidence or risk |
|---|---|---|
| Users live in India and have +91 numbers | Unchecked | Default region `IN` on client and server; SMS limited to India; non-Indian numbers in an address book still match if saved with a country code |
| Time zone is India (IST) | Unchecked | Reminders, due-date parsing and push dates use Asia/Kolkata; client wording uses the device's own calendar, so a phone in another zone can disagree by a day |
| Device clocks are roughly right | Unchecked | The 48 h pick-up window and "expires in" labels are computed on the device |
| Scale is about 10 users with about 200 books each | Unchecked | SPEC §1; one live query per linked owner, 480 copies per collection operation, 5000 contacts per sync |
| Friends trust each other: no deposits, no penalties, owner stays in control | Unchecked (product choice) | One-way requesters can ask; owners see "Not in your contacts" (H2) |
| The phone number is the identity | Checked in code | A new number is a new, empty account (H9) |
| People save friends' numbers in their address book | Unchecked | Without saved numbers nobody appears; invites ask "save my number" |
| WhatsApp is installed | Partly checked | QA on a phone without WhatsApp: hand-offs opened the browser; the app still works |
| The other person may have push off | Checked (design) | Every state change that pushes also offers a WhatsApp button |
| Open Library and Google Books cover most books | Partly checked | QA saw Open Library at about 19 s and Google Books 429 errors; manual add still works; Google Books runs without an API key |
| Users read English | Unchecked | All copy is English |
| Most testers use Android; iOS behaves the same | Unchecked | iOS never built or run |
| Android 13+ notification permission flow | Checked | Pre-prompt and OS dialog passed on Android 16 and 17 |
| A device belongs to one account at a time | Checked | `registerPushToken` moves the token; sign-out/in on one phone passed (S15) |
| Firebase Auth uids never contain `_` | Unchecked in code | Review and watch ids are split on `_` by the rules |
| Free tiers cover the load | Unchecked | No usage data yet; budget alerts recommended |
| Books are the only category | Checked in code | `category: 'book'` everywhere; names are generic for later |
| Editions and translations share one Book (Open Library work) | Checked in code | Duplicate works across catalogues are merged only on the client (same title and first author) |

## Known limits and open items

### Before going live

| Item | Effect today | What's needed | Source |
|---|---|---|---|
| Push delivery | No device has a push token; every push logs "Push skipped: no tokens" | Owner steps: `eas init`, paste the project id into `EAS_PROJECT_ID_DEFAULT`, register `com.lendshelf.app.dev` in dev, upload Firebase files and FCM V1 / APNs keys to EAS | README "Push notifications setup" |
| Prod release signing keys | Phone sign-in on prod doesn't work | Add the release and Play app signing SHA-1/SHA-256 to the prod Android app, re-run `npm run firebase:config -- prod` | README "Going live" |
| App Check | Off in both projects; the app has no provider | Add the App Check SDK, register providers, set `ENFORCE_APP_CHECK=true`, deploy | functions/README "App Check" |
| Prod backend behind dev | Prod lacks the 22-27 Nov function fixes: cold-start changes, noon-IST due dates, calendar-day reminders, `recordLoan` `onApp` | `npm run deploy:prod` (or `deploy:prod:functions`) when ready | PROGRESS workstreams 12, 16, 17 |
| Old due dates | Loans saved on dev before the fix keep 05:30 IST times; prod data not checked | Check or migrate before prod use | QA-ANDROID bug D |
| iOS | Never built, signed or run | Mac or EAS build, TestFlight, Apple Developer account | HANDOFF "Not verified yet" |
| Accessibility | TalkBack and 200 % font never tested on a device | Device pass (C14) | QA-ANDROID "Not tested" |
| Invite link (H1) | Invite text says "Ask me for the app link" | A landing page; set `EXPO_PUBLIC_INVITE_URL` | UX-FLOWS H1, [invite-text.ts:12](../../src/features/invite/invite-text.ts#L12) |
| Privacy policy | Screen exists but hasn't been reviewed | Review before wider release | README "Going live" |
| Push receipts | Only tickets are read; FCM/APNs errors in receipts are missed | Poll receipts if delivery problems appear | [push.ts:136](../../functions/src/lib/push.ts#L136) |

### Remaining polish (from QA-ANDROID.md)

- Home search rows say "With you" during the pick-up window, where other screens say "Pick up from …".
- A saved name whose first word is "LendShelf" reads oddly ("LendShelf can see it in LendShelf").
- A deep link to a loan you were never part of says "isn't shared with you any more".
- Tapping Clear search on Home also opens the keyboard.
- No pull to refresh.
- The Add button label can be cut short for long collection names.
- Sheet close buttons are smaller than the 48 dp target; with the keyboard up on Scan, the scanned list is hidden.

### Product questions still open

| # | Question | Recommended default |
|---|---|---|
| H2 | Let owners restrict requests to people they have saved? | No setting in v1.1 |
| H5 | Make wishlists visible to the circle? | Keep private |
| H7 | A `lost` reason for closing a loan? | Yes, after v1.1 |
| H8 | Households: shared shelves? | One account per person |
| H9 | Phone number change keeps the account? | Help sheet first, backend later |
| H10 | Reopen a loan closed by mistake? | Server `reopenLoan` for 10 minutes, later |
| H12 | Edit a recorded loan's borrower? | Yes, low priority |

Full wording: [UX-FLOWS.md §H](../ux/UX-FLOWS.md#h-open-questions-for-the-product-owner).

### Observations from this review

These came from reading the code and are not yet in another doc.

- **`recordLoan` to an app user's number.** The loan links to that user and shows in their Loans tab even if they don't have the owner saved; only the push is suppressed. The `onApp` result also tells the owner whether a number is on LendShelf, and `recordLoan` has no rate limit, unlike `syncContacts` ([loans.ts:267-339](../../functions/src/handlers/loans.ts#L267)). Each probe needs an available copy and creates a loan the other person can see.
- **Change due date racing "I've returned it" (fixed 27 Nov).** The client treated `changeDue` as valid on `returnPending` loans while the server allows it only on `active` ones, so the owner got a generic error instead of "<borrower> says it's back". The client table now matches the server ([stale.ts](../../src/features/loans/stale.ts)).
- **Unused indexes.** Seven of the eight composite indexes serve no current query, because the app sorts on the device ([ARCHITECTURE.md §3.3](ARCHITECTURE.md#33-client-queries-and-indexes)).
- **Server doesn't decline on hide or private.** The decline-then-change order lives only in the app; any other client could hide a copy and leave requests open (G34).

## Older docs that disagreed with the code

These were found while writing this overview and corrected on 27 Nov, so the older docs now match the code:
- [functions/README.md](../../functions/README.md): date-only due dates are noon IST; "due soon" is the day before and "overdue" the day after, by India calendar day; the optional `EXPO_ACCESS_TOKEN` secret; `recordLoan` returns `{ loanId, onApp }`.
- [SPEC.md](../../SPEC.md): the extra loan fields (`notBackYetAt`, `returnEvents`, `dueChangedAt`, `firstDueDate`, `borrowerLeftAt`), `closedReason: copyRemoved`, HEIF covers, "Lent · back 12 Dec", the `recordLoan` result, and a pointer from the old screen list to [USER-FLOWS.md](USER-FLOWS.md).
- [DECISIONS.md](../../DECISIONS.md) row 13 (reminders), [PROGRESS.md](../../PROGRESS.md) commands and workstream 6, and the code comments in `session.ts`, `functions/src/model.ts` and `maintenance.ts`.
- [MULTI-DEVICE-TESTS.md](../ux/MULTI-DEVICE-TESTS.md) S9 now expects what the spec says (books move, requests on a now-private copy are declined).

Still differing, as a known gap:
- UX-FLOWS E8 says the last collection and visibility on Add are remembered between sessions; the app keeps them only while it runs.
- UX-FLOWS items not built are listed in [FEATURE-MAP.md](FEATURE-MAP.md).

HANDOFF.md's "Earlier handoff (v1, emulators only)" section is marked outdated in place and isn't repeated here.
