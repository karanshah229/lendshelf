# LendShelf — product and system spec (v1)

LendShelf is a private lending library for friends and family. Everyone lists the books they own; anyone who has your number saved in their phone can see your shared books, ask to borrow them, and read reviews. WhatsApp is where people talk; LendShelf is the system of record.

v1 is **books only**, but records are named generically (`Item`, `Loan`, `category`) so other kinds of things can be added later without a data migration.

---

## 1. Product decisions

| Topic | Decision |
|---|---|
| Lending | Free. No money, deposits or payments. |
| Platforms | Android and iOS, one Expo React Native codebase. A web build exists only for development and demos against the Firebase emulators. |
| Distribution (testing) | Android: APK built locally or with EAS and sent directly. iOS: TestFlight. |
| Sign-in | Phone number + SMS code (Firebase Auth). |
| Network | **One-way contact matching**: if I have your number saved, I can see your shared items. No friend requests. |
| Privacy controls | Collections (shelves) are public or private. Each copy is `lendable`, `visible` (shown, not lendable) or `hidden`. |
| Book vs copy | **Book** (`Work`) = the shared, reviewable record. **Copy** (`Item`) = one owner's physical book. |
| Reviews | Belong to the **Book only**. A copy page shows its Book's reviews. One review per person per Book (1–5 stars + optional text), editable. Anyone can review, owner or not. You see your own review plus reviews by people you have saved. |
| Ratings | Average is computed on the device from the reviews you can see. No global average is stored. |
| Editions | Editions and translations share one Book (Open Library work). The copy stores ISBN, format, language. |
| Custom books | Books without an ISBN/catalogue match. **Private to their creator**: only the creator can attach copies and edit details. No special label in the UI. Can later be upgraded to a catalogue Book (v1.1). |
| Limits | No limit on books per person. Sizing assumption: ~10 users × ~200 books. |
| Loans | Owner stays in control. Borrow requests expire after 7 days. Default due date 21 days. Owners can lend to people who aren't on the app. |
| Loan visibility | Contacts see "Lent out · back 12 Dec". Only owner and borrower see who has it. |
| Conversation | WhatsApp deep links (`https://wa.me/<digits>?text=...`) with prefilled messages. No in-app chat. |
| Reminders | Push notifications (Expo push) + a "Nudge on WhatsApp" button for owners. |
| Wishlist | "Notify me when a contact adds this Book." Also "Notify me when this copy is back." No queues. |
| Names | Owners are shown by the name **you** saved them as in your contacts; fall back to their profile name. |
| Contacts | Only matched numbers are stored (as links). The address book is never uploaded or stored beyond the sync call. |
| Export | CSV (one row per copy) and JSON (copies + loan history + your reviews), generated on device, shared via the share sheet. No import. |
| Account deletion | In-app, removes all the user's data. |

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| App | Expo (latest SDK), Expo Router, TypeScript strict |
| UI | NativeWind v4 + React Native Reusables (shadcn/ui for React Native) + lucide-react-native. Neutral shadcn palette, light + dark mode. |
| Firebase on native | `@react-native-firebase/*` (app, auth, firestore, functions, storage) — requires a dev build / prebuild, not Expo Go |
| Firebase on web | `firebase` JS SDK (modular). Web is dev/demo only. |
| Platform split | `src/lib/firebase/index.ts` (web, JS SDK) and `src/lib/firebase/index.native.ts` (RNFirebase modular API) export the same functions. App code imports only from `@/lib/firebase`. |
| Backend | Cloud Functions for Firebase v2, Node 22, TypeScript, region `asia-south1` |
| Database | Cloud Firestore |
| Files | Cloud Storage (custom book cover photos) |
| Local dev | Firebase Emulator Suite, project id `demo-lendshelf` (auth 9099, firestore 8080, functions 5001, storage 9199, UI 4000) |
| Book data | Open Library (primary), Google Books (fallback for ISBNs Open Library lacks) |
| Push | Expo push service (`expo-notifications`, Expo push tokens) |
| Contacts | `expo-contacts`; numbers normalised to E.164 with `libphonenumber-js` using the device region (default `IN`) |
| Scanning | `expo-camera` barcode scanning (EAN-13), continuous mode |
| Tests | Jest (`jest-expo`) for app logic; Vitest + `@firebase/rules-unit-testing` for rules; Vitest against emulators for functions |

App id: `com.lendshelf.app` (Android package and iOS bundle id).

---

## 3. Data model (Firestore)

All timestamps are Firestore `Timestamp`. `category` is `"book"` in v1.

### `users/{uid}` — private to the user
| Field | Type | Notes |
|---|---|---|
| phone | string | E.164 |
| pushTokens | string[] | Expo push tokens |
| createdAt | Timestamp | |

### `profiles/{uid}` — readable by any signed-in user
| Field | Type | Notes |
|---|---|---|
| name | string | 1–60 chars |
| pickupNote | string \| null | e.g. "My place, weekends". ≤ 200 chars |
| createdAt, updatedAt | Timestamp | |

### `phoneIndex/{e164}` — backend only
`{ uid }`

### `links/{viewerId}_{ownerId}` — "viewer has owner's number saved"
| Field | Type |
|---|---|
| viewerId | string |
| ownerId | string |
| ownerPhone | string (E.164) |
| createdAt | Timestamp |

Written only by `syncContacts`. Readable by the viewer only (owners never learn who saved them).

### `works/{workId}` — the Book
| Field | Type | Notes |
|---|---|---|
| category | "book" | |
| source | "openlibrary" \| "googlebooks" \| "custom" | |
| title | string | |
| authors | string[] | |
| description | string \| null | |
| coverUrl | string \| null | |
| firstPublishYear | number \| null | |
| isCustom | boolean | |
| createdBy | string \| null | uid, custom books only |
| createdAt, updatedAt | Timestamp | |

Work ids: `ol_<OpenLibraryWorkKey>` (e.g. `ol_OL45804W`), `gb_<volumeId>`, `custom_<autoId>`.
Catalogue works are created only by the `resolveBook` function. Custom works are created by their owner.

### `isbnIndex/{isbn13}` — backend only
`{ workId }` so every scan of the same ISBN lands on the same Book.

### `shelves/{shelfId}` — a user's collection
| Field | Type |
|---|---|
| ownerId | string |
| name | string (1–40) |
| isPublic | boolean |
| sortOrder | number |
| createdAt, updatedAt | Timestamp |

Every user gets a default public shelf "My books" on sign-up.

### `items/{itemId}` — a copy
| Field | Type | Notes |
|---|---|---|
| ownerId | string | |
| workId | string | |
| category | "book" | |
| shelfId | string | |
| visibility | "lendable" \| "visible" \| "hidden" | |
| sharedWithContacts | boolean | **Derived**: shelf.isPublic && visibility != "hidden". Rules enforce it. |
| title | string | copied from Work (for search) |
| authors | string[] | copied from Work |
| coverUrl | string \| null | edition cover, own photo, or Work cover |
| isCustom | boolean | copied from Work |
| isbn | string \| null | |
| format | "paperback" \| "hardcover" \| "other" \| null | |
| language | string \| null | |
| loanState | "available" \| "lent" | backend only |
| dueDate | Timestamp \| null | backend only |
| activeLoanId | string \| null | backend only |
| createdAt, updatedAt | Timestamp | |

### `loans/{loanId}`
| Field | Type | Notes |
|---|---|---|
| itemId, workId | string | |
| ownerId | string | |
| ownerName, ownerPhone | string | |
| borrowerUid | string \| null | null when the borrower isn't on the app |
| borrowerName | string | |
| borrowerPhone | string \| null | E.164 |
| title | string | denormalised |
| coverUrl | string \| null | denormalised |
| status | "requested" \| "declined" \| "cancelled" \| "expired" \| "active" \| "returnPending" \| "returned" | |
| message | string \| null | borrower's note on request |
| dueDate | Timestamp \| null | |
| requestedAt, startedAt, returnMarkedAt, returnedAt | Timestamp \| null | |
| updatedAt | Timestamp | |

Readable by owner and borrower. **All writes go through callable functions.**

### `reviews/{workId}_{uid}`
| Field | Type |
|---|---|
| workId | string |
| authorId | string |
| authorName | string |
| rating | 1–5 integer |
| text | string \| null (≤ 2000) |
| createdAt, updatedAt | Timestamp |

Readable by the author and by anyone who has the author saved (`links/{reader}_{author}` exists). The client reads reviews **by document id** (`${workId}_${uid}` for itself and each linked owner), which avoids query-rule limitations.

### `watches/{uid}_{type}_{targetId}`
| Field | Type |
|---|---|
| uid | string |
| type | "wishlist" (targetId = workId) \| "back" (targetId = itemId) |
| targetId | string |
| workId | string |
| title | string |
| createdAt | Timestamp |

Private to `uid`.

### Storage
`covers/{uid}/{fileName}` — write by `uid` (images ≤ 5 MB), read by any signed-in user.

---

## 4. Security rules (summary)

- `users/{uid}`: read/write by `uid`; client may not write anything except `pushTokens` and `phone` must equal the auth token phone.
- `profiles/{uid}`: read by any signed-in user; write by `uid` with field validation.
- `phoneIndex`, `isbnIndex`, `links` (write), `loans` (write): backend only.
- `links`: read when `resource.data.viewerId == auth.uid`.
- `works`: catalogue works readable by any signed-in user; custom works readable by creator or anyone with `links/{me}_{creator}`; custom works create/update by creator only (`isCustom == true`, `createdBy == auth.uid`, id starts with `custom_`).
- `shelves`: owner full access (create/rename/sortOrder; **isPublic changes go through `setShelfVisibility`**); others read when `isPublic && links/{me}_{owner}` exists. Delete through `deleteShelf`.
- `items`: owner create/update/delete with validation (`loanState`, `dueDate`, `activeLoanId` unchanged / defaults; `sharedWithContacts` consistent with the shelf; can't delete while lent; custom work must be own). Others read when `sharedWithContacts == true && links/{me}_{owner}` exists.
- `reviews`: create/update/delete by author, id must be `${workId}_${auth.uid}`; read by author or linked viewer.
- `watches`: owner only, id must match fields.

Client queries must be provable by rules: e.g. `items where ownerId == X and sharedWithContacts == true` (one query per linked owner), `loans where ownerId == me`, `loans where borrowerUid == me`, `links where viewerId == me`, `shelves where ownerId == X and isPublic == true`.

---

## 5. Cloud Functions (region `asia-south1`)

All callables require auth. Errors use `HttpsError` with clear messages.

| Name | Type | Input → Output | Behaviour |
|---|---|---|---|
| `onUserCreated` | Auth trigger (v1 `auth.user().onCreate`) | — | Write `users/{uid}`, `phoneIndex/{phone}`, default shelf "My books". Idempotent. |
| `completeProfile` | callable | `{ name }` → `{ ok }` | Creates/updates `profiles/{uid}`; also ensures `users`, `phoneIndex`, default shelf exist (fallback if the trigger lags). |
| `syncContacts` | callable | `{ phones: string[] }` (≤ 5000, E.164) → `{ links: {ownerId, ownerPhone, name}[] }` | Look up `phoneIndex`, upsert links for matches (excluding self), delete links no longer present. |
| `resolveBook` | callable | `{ isbn }` \| `{ olWorkKey, isbn? }` \| `{ gbVolumeId, isbn? }` → `{ workId, work, edition: { isbn, coverUrl, language, publisher, publishYear } }` | Find or create the Work. ISBN path: `isbnIndex` → Open Library `/isbn/{isbn}.json` → work → authors; fallback Google Books. Writes `isbnIndex`. Sets a generic `User-Agent: LendShelf/0.1`. |
| `setShelfVisibility` | callable | `{ shelfId, isPublic }` → `{ updated }` | Owner only; updates the shelf and recomputes `sharedWithContacts` on all its items in one batch. |
| `deleteShelf` | callable | `{ shelfId, moveToShelfId }` → `{ moved }` | Owner only; moves items, recomputes `sharedWithContacts`, deletes shelf. Can't delete the last shelf. |
| `requestLoan` | callable | `{ itemId, message? }` → `{ loanId, ownerPhone }` | Caller must have the owner saved; item must be shared, `lendable`, `available`; caller not owner; no open request by caller for this item. |
| `respondToRequest` | callable | `{ loanId, accept, dueDate? (ISO) }` → `{ ok }` | Owner only. Accept → `active` (due default +21 days), item `lent`; other open requests for the item → `declined`. Decline → `declined`. Push to borrower. |
| `cancelRequest` | callable | `{ loanId }` | Borrower only, `requested` → `cancelled`. |
| `recordLoan` | callable | `{ itemId, borrowerName, borrowerPhone?, dueDate? }` → `{ loanId }` | Owner lends directly (also to non-app people). Matches `borrowerPhone` to a user via `phoneIndex`. Item must be available. |
| `markReturned` | callable | `{ loanId }` | Borrower: `active` → `returnPending`. Push to owner. |
| `confirmReturn` | callable | `{ loanId }` | Owner: `active`/`returnPending` → `returned`; item `available`; notify and delete `back` watches for the item; push borrower to review. |
| `updateDueDate` | callable | `{ loanId, dueDate }` | Owner, active loans. |
| `onItemWritten` | Firestore trigger | — | When an item becomes `sharedWithContacts`, push "<owner> added <title>" to users with a `wishlist` watch on that Work who have the owner saved. |
| `dailyMaintenance` | Scheduled 09:00 Asia/Kolkata | — | Expire `requested` loans older than 7 days; push "due in 2 days" and "overdue" reminders. |
| `deleteAccount` | callable | `{}` | Removes the user's items (closing their loans), shelves, reviews, watches, links (as viewer and owner), profile, users doc, phoneIndex, storage covers, then the auth user. Loans where they were borrower keep the name but drop `borrowerUid`. |

Push sending goes through a small `sendPush(uids, message)` helper that reads `users/{uid}.pushTokens` and POSTs to `https://exp.host/--/api/v2/push/send`; it is a no-op when running in the emulator without tokens.

---

## 6. Screens

Sign-up (before tabs): **Phone** → **Code** → **Your name** → **Contacts** (explains why, then asks permission; can skip).

| Tab / screen | Contents |
|---|---|
| **Discover** (tab) | Search across your own and contacts' shared copies (on-device, by title/author). Results grouped by Book: owner names + status. Empty state: search the Open Library catalogue → add to wishlist or open the Book. Shows "New from your contacts" when not searching. |
| **Book page** `/book/[workId]` | Cover, title, authors, year, description. Copies in your circle (owner, status, Ask). Reviews you can see + average. Write/edit review. Wishlist toggle. "I own this" → add a copy. |
| **Copy page** `/copy/[itemId]` | Book header; owner (contact name), pickup note; edition/format/language; status. Viewer actions: Ask to borrow (opens WhatsApp after creating the request), Notify me when back, Message on WhatsApp. Owner actions: visibility, collection, Lend, Mark returned, Edit, Delete. Reviews of the Book. |
| **Person** `/person/[uid]` | A contact's public collections and their shared copies. |
| **My books** (tab) | Collections switcher, grid/list of your copies with status badges, + Add button. |
| **Add book** `/add` | Search (title/author) · Scan (continuous ISBN; review queue) · Manual (custom book: title, authors, optional cover photo). Then confirm collection, visibility, format, language. |
| **Collections** `/shelves` | Create, rename, reorder, public/private, delete (choose where copies go). |
| **Lend** `/lend/[itemId]` | Pick an app contact, any phone contact, or type a name/number; due date. |
| **Review** `/review/[workId]` | Stars + text; delete. |
| **Loans** (tab) | Requests (accept/decline), Lent out (nudge on WhatsApp, mark returned, change due date), Borrowed (I've returned it, cancel request). |
| **Me** (tab) | Name, pickup note, contacts sync status + resync, Wishlist, Export CSV/JSON, theme, privacy policy, sign out, delete account. |

Dev-only conveniences (emulator mode): the Code screen shows the code fetched from the Auth emulator; on web, the Contacts screen lets you enter numbers manually (web has no address book).

---

## 7. Out of scope for v1

Categories other than books, custom→catalogue upgrade, shared household shelves, queues/waitlists, in-app chat, import, public store listings, recommendations engine.
