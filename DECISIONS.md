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
