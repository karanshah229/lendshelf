# Decisions made during the overnight build

Product decisions agreed with the owner are in SPEC.md §1. This file records system and product decisions made autonomously during the build, with the reason.

| # | Decision | Why |
|---|---|---|
| 1 | Project name **LendShelf**, app id `com.lendshelf.app` | Works for books now and "lend anything" later. Easy to rename before store release. |
| 2 | Native uses React Native Firebase; web uses the Firebase JS SDK behind one `@/lib/firebase` module | Phone sign-in on native needs RNFirebase; web build is used for dev/demo against emulators. |
| 3 | All loan writes go through callable functions | Loan state touches two users and an item; doing it server-side keeps it consistent and keeps rules simple. |
| 4 | Shelf public/private toggles and shelf deletion go through callables | They must recompute `sharedWithContacts` on up to hundreds of items atomically. |
| 5 | Reviews are read by document id (`workId_uid`) for me + each linked owner | Firestore rules can't filter list queries by "author is in my contacts". |
| 6 | Push via Expo push service | One token type for Android and iOS; no APNs/FCM server code. |
| 7 | Functions region `asia-south1` | Users are in India (WhatsApp + phone contacts); lowest latency. |
| 8 | Local dev project id `demo-lendshelf` | `demo-` projects run fully on emulators with no cloud project or login. |
| 9 | Emulators run through `functions/scripts/firebase.mjs` with firebase-tools as a devDependency | The global CLI shim was broken and firebase-tools 15 needs Java 21+; the script finds Android Studio's bundled JBR and fixes a Windows loopback issue. |
| 10 | Default shelf id is `default_{uid}` | Lets the client and backend create/locate it without a query. |
| 11 | `isbnIndex` caches the edition details | Repeat scans of the same ISBN need no network. |
| 12 | Due dates must be today … +1 year; accepting a >7-day-old request expires it | Prevents nonsense dates and stale accepts. |
| 13 | Reminders: "due soon" 24–48 h before due; "overdue" on day 1 then weekly; to borrower and owner | Gentle, not nagging. |
| 14 | If an Open Library work title is non-Latin but the scanned edition's is Latin, use the edition title | Otherwise e.g. Crime and Punishment shows in Russian. |
| 15 | iOS `useFrameworks: "dynamic"` | React Native Firebase (current) is SPM-only; static frameworks break `pod install`. |
| 16 | Contacts onboarding step is tracked per device | A new phone needs contacts permission anyway. |
| 17 | Contact sync with an empty list is skipped | Prevents wiping all links when permission is denied or contacts fail to load. |
| 18 | Profiles are readable by id only, not listable | Listing would let any user enumerate every user's name. |
| 19 | Item rules don't read catalogue works (`ol_`/`gb_` ids); only custom works are read | Firestore allows 20 document reads per batch; reading every work capped a batch of new copies at 19. Catalogue works are created only by `resolveBook`. |
| 20 | `coverUrl` allowlist (catalogue hosts, Firebase Storage, Storage emulator) and string-only `authors` in rules; Storage covers raster-only | Stops arbitrary tracking URLs / SVG script in other users' apps. Physical-device dev with a LAN IP for the Storage emulator isn't allowed by the rules. |
| 21 | Client timestamps must equal `request.time` | Prevents back-dated or future `createdAt`/`updatedAt`. All client writes already use `serverTimestamp()`. |
| 22 | `resolveBook` trusts a client ISBN given with a work key/volume id only if the catalogue confirms it belongs to that work | Otherwise one client could map an ISBN to the wrong Book in `isbnIndex` for everyone. |
| 23 | Pushes about a loan the owner recorded go to the borrower only if the borrower has the owner saved; `back` watchers likewise, and only for shared copies | `recordLoan` accepts any number, so it could otherwise push attacker-chosen text to any app user. |
| 24 | `syncContacts`: 20 calls per user per rolling 24 h (`rateLimits/{uid}`) | Limits phone-number probing. |
| 25 | App Check enforcement is an env opt-in (`ENFORCE_APP_CHECK`), off by default | Emulators and current builds have no App Check; must be turned on before production. |
| 26 | Push tokens are registered through `registerPushToken`/`unregisterPushToken`; a device belongs to one account; 20 newest kept; `DeviceNotRegistered` tokens removed | Stops pushes to a previous account on a shared phone and stale-token build-up. |
| 27 | Deleting a copy cancels its open requests (trigger); daily expiry uses a `lastUpdateTime` precondition; `deleteAccount` aborts before deleting the Auth user if any write failed | Keeps loan state consistent and lets the user retry a partial deletion. |
| 28 | Test scripts use `firebase.test.json` (all emulator ports +10000, no UI) | Tests can run while the dev emulators are up, without touching their data. |
| 29 | Sign-out does not clear Firestore's offline cache | Web uses the default memory cache (nothing is written to IndexedDB), so there is nothing to clear. Native (RNFirebase) can only `clearPersistence()` after `terminate()`, which stops the one shared `db` instance every module holds (all listeners and writes) until the app restarts, and needs a change in `index.native.ts`. Rules still check every server read and all queries are scoped to the signed-in uid. Revisit with a clear on the next cold start before first use. |
| 30 | A borrower can always open the copy they have; if the copy can't be read (hidden, private collection, owner not saved, removed) the copy page is built from the open loan's title/cover/owner name with "I've returned it" and "Message" | The loan is the borrower's record; "Copy not found" left them without the return action outside the Loans tab. |
| 31 | New copies are committed 19 per batch, each new custom Book with its copy (`chunkCopyWrites`) | Rules allow 20 reads per request; a copy of an existing custom Book costs one, the shelf one per batch (functions README). Batches commit one after another, so a failure part-way keeps the earlier copies. |
| 32 | Cover photos: `image/jpg` is sent as `image/jpeg`; other types than JPEG/PNG/WebP/HEIC/HEIF are refused when picked (and again before upload); unknown types are sent as JPEG | Matches the Storage rules with a readable message instead of a permission error. |
| 33 | Push tokens go only through `registerPushToken`/`unregisterPushToken`; `arrayUnion`/`arrayRemove` stay exported from `@/lib/firebase` although unused | Removing them needs the same change in `index.native.ts` (export parity check); tidy up later. |
| 34 | The Add flow remembers collection and visibility between books, not format or language; language starts as the catalogue's detected language, else unset | A silently carried-over format/language was wrong for the next book more often than right. |
| 35 | Status wording: a copy I'm borrowing reads "With you" (not "Lent out"); my hidden copy reads "Hidden" (not "Not lendable"); the Loans nudge button reads "Nudge" (accessibility label still says WhatsApp) | QA feedback; "Nudge on WhatsApp" wrapped at 375 px. |
| 36 | Item and work `authors` are coerced to `string[]` when read (`fromSnap`/`fromQuerySnap`), and search ignores non-string titles/authors | Documents written before the rules checked `authors` could otherwise crash lists and search. |
| 37 | Discover, My books and Loans show "Couldn't load … / Retry" when a live query fails; Retry re-subscribes (`retry()` on the list hooks) | A failed listener stops for good, and an empty state would wrongly say there is nothing. |
