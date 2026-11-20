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
