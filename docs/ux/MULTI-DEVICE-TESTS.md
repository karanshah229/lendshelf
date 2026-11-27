# Two-phone test scenarios

Manual end-to-end scenarios for LendShelf with two people on two real phones, plus a third person on the web build. They run against the `lendshelf-dev` Firebase project. Spec: [UX-FLOWS.md](UX-FLOWS.md). Earlier results: [QA-ANDROID.md](QA-ANDROID.md).

## Cast and setup

| Who | Where | Test number | Saved contacts |
|---|---|---|---|
| Asha | Phone A | +91 90000 00001 | Ravi, Meera |
| Ravi | Phone B | +91 90000 00002 | Asha only |
| Meera | Web build (`npm run dev:web`), or phone B after switching accounts | +91 90000 00003 | Asha only (added by hand on web) |
| Throwaway | Phone B after switching, then deleted | +91 90000 00004 or 05 | Asha |

Codes for the test numbers are in `firebase-config/TEST-NUMBERS.md` (git-ignored). Contacts on phones are named "LendShelf Test Ravi" and so on, and are removed after the run.

Visibility this gives (matching is one-way):
- Asha sees Ravi's and Meera's shared books.
- Ravi and Meera see Asha's.
- Ravi and Meera don't see each other.

Use fresh books with a run prefix in the title (for example "MD1 Hobbit") so older dev data doesn't confuse results. "Live" means the other phone updates without a manual refresh within about 10 s.

## Scenarios

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| S0 | Setup and one-way visibility | Both phones sign in and sync contacts. Ravi and Asha each add a book. Meera adds a book on web. | Asha sees Ravi's and Meera's books. Ravi sees Asha's but not Meera's. The incomplete-contacts guard behaves sensibly. |
| S1 | Borrow, happy path | Ravi adds MD1. Asha asks to borrow it. Ravi accepts with a due date and pickup note. Asha marks "I've returned it". Ravi taps "Got it back". | Each step shows live on the other phone: Needs-you card, Loans badge, pick-up wording, return card. The book is available again. Review prompt appears. Timeline is complete on both sides. |
| S2 | Decline with each reason | Asha asks for three of Ravi's books. Ravi declines with reading it, not lending, and lent to someone else. | Asha sees the reason in words. "Lent to someone else" sets up a back-watch. |
| S3 | Competing requests | Asha adds MD3. Ravi (phone B) and Meera (web) both ask for it. Asha accepts Ravi's request (with exactly two requesters the card offers "Lend to Ravi" / "Lend to Meera"). | Meera's request is auto-declined as lent to someone else, with a back-watch, and she sees it live. When the loan ends, Meera's watch fires. |
| S4 | Stale actions and races | Asha cancels while Ravi has the Accept sheet open. Then both tap at the same moment: accept and cancel. | Ravi's sheet closes with a plain message ("Asha cancelled this request"). Exactly one action wins, and the other phone shows a plain message, never a code. |
| S5 | Return dispute | Asha marks returned. Ravi taps "Not back yet". Asha marks returned again. Ravi taps "Got it back". | Asha sees "Ravi hasn't got it back yet" with Message. The timeline on both phones keeps every event. |
| S6 | Not collected | Ravi accepts. Within the pick-up window Ravi chooses "Not collected". | Loan closes as cancelled, with no review prompt. The book is available again. Watchers get "available again". |
| S7 | Due date change | Ravi changes the due date on an active loan. | Asha sees the new date live and a "Due date moved" timeline entry. The first due date stays in history. |
| S8 | Hide or make private while someone looks | Asha has Ravi's copy open. Ravi hides it, then moves another copy to a private shelf. | Asha's screen says the copy isn't shared any more and offers other copies. A pending request is handled as the spec says. |
| S9 | Delete a shared collection with a pending request | Asha requests a book in a shared collection of Ravi's. Ravi deletes the collection and moves its books to a private one. | A named confirm lists Asha's request; it is declined as "not lending" and Asha sees it in words. (Books are moved, never deleted, so "copy removed" can't happen here.) |
| S10 | Owner records a loan to an app user | Ravi lends a book to Asha through "Lend a book". | Asha sees it under With you (she has Ravi saved). |
| S11 | Wishlist hit | Asha wishlists a title that isn't in her circle. Ravi adds that book. | Asha sees it under From your wishlist. The push is attempted (not delivered: no EAS project yet). |
| S12 | Notify me when it's back | Asha taps "notify me" on Ravi's lent-out book. The loan ends. | The watch fires and clears. Asha sees the book is available. |
| S13 | Reviews visibility | Ravi reviews a book after a loan. | Asha sees Ravi's review. Meera, who doesn't have Ravi saved, doesn't. |
| S14 | Live updates and refresh | Both phones keep the same loan open while the other acts. Pull to refresh. Kill and reopen. | Screens update live. Nothing is stale after reopening. |
| S15 | Switching accounts on one phone | On phone B, Ravi signs out and Meera signs in. Look at Home, My books, Loans, Me, the person pages and notifications. Kill and reopen. Switch back to Ravi. | Nothing of Ravi's shows for Meera: books, loans, saved names, Needs-you cards, contacts state, draft text, pending deep links. Ravi's data is all back after switching back. |
| S16 | A person leaves with an active loan | A throwaway user borrows from Asha, then deletes their account. | Asha sees "<name> left LendShelf" and can still close the loan. |
| S17 | Overdue and Nudge across phones | Backdate an active Ravi→Asha loan on dev and run the daily job. | Both phones show overdue cards and the badge. Nudge opens WhatsApp with the right text (back out, never send). |
| S18 | Deep link to someone else's loan | Open `lendshelf://loan/<id>` of a loan between Ravi and Meera on phone A. | A plain "not available" screen, no data leak, no crash. |
| S19 | Notification permission on both phones | First Ask on each phone. | The pre-prompt shows, then the OS dialog. Me shows the right state. |

## How to record results

Add a dated section to [QA-ANDROID.md](QA-ANDROID.md) with Pass / Fail / Partly per scenario, bug details and screenshots names (screenshots stay out of the repo).
