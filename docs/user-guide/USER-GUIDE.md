# LendShelf user guide (Android)

LendShelf is a lending library for friends and family. You see the books of people whose phone number you have saved, you ask to borrow in the app, and you sort out the hand-over on WhatsApp. This guide walks through every flow with screenshots from a real phone.

## Before you start

### Who is who

The screenshots use test accounts on the `lendshelf-dev` Firebase project. No real people appear.

| Person | Test number | Role in this guide |
|---|---|---|
| Asha Rao | +91 90000 00001 | Mostly the borrower. She has Ravi's number saved, so she sees his books. |
| Ravi Menon | +91 90000 00002 | Mostly the owner. He has Asha in his circle, so he sees her books too. |
| Tara Iyer | +91 90000 00004 | A brand-new user, used for sign-up and account deletion. |
| Nikhil | none | A neighbour who isn't on LendShelf. Ravi lends him a book in person. |

Matching is one-way: you see someone's books when *you* have *their* number saved. Each two-person step says whose phone it is, for example "Ravi's phone (owner)".

### Install the dev build

1. Build the Android release APK against `lendshelf-dev` (see [Android build](../../README.md#android-build) in the README), then install it with `adb -s <serial> install -r android/app/build/outputs/apk/release/app-release.apk`. Once EAS is set up, `npx eas-cli build -p android --profile dev` gives an installable APK instead.
2. Open LendShelf and sign in with a dev test number, +91 90000 00001 to 05. These numbers don't get an SMS. Their codes are in `firebase-config/TEST-NUMBERS.md`, which is git-ignored, or in the Firebase console.

Screenshots were taken on a Pixel 6a (Android 17, dark mode) with the dev build of 27 Nov 2026.

### How a loan moves

```mermaid
flowchart LR
    A[Asha asks] --> B{Ravi answers}
    B -- Accept --> C[Pick-up window]
    B -- Decline --> X[Closed with a reason]
    C --> D[Asha reads]
    D --> E[Asha: I've returned it]
    E --> F[Ravi: Got it back]
    F --> G[Closed, How was it?]
    D -. past due date .-> O[Overdue: nudges]
    O --> E
```

## Contents

- [F1 Sign in and set up](#f1-sign-in-and-set-up)
- [F2 Find a book](#f2-find-a-book)
- [F3 Ask to borrow](#f3-ask-to-borrow)
- [F4 Answer a request](#f4-answer-a-request)
- [F5 Pick up, return and confirm](#f5-pick-up-return-and-confirm)
- [F6 Overdue and nudges](#f6-overdue-and-nudges)
- [F7 Lend in person](#f7-lend-in-person)
- [F8 Add books](#f8-add-books)
- [F9 Manage my library](#f9-manage-my-library)
- [F10 Reviews](#f10-reviews)
- [F11 Wishlist and notify when back](#f11-wishlist-and-notify-when-back)
- [F12 Notifications](#f12-notifications)
- [F13 Profile, contacts and pickup note](#f13-profile-contacts-and-pickup-note)
- [F14 Export](#f14-export)
- [F15 Sign out and delete account](#f15-sign-out-and-delete-account)

---

## F1 Sign in and set up

**Goal:** get from a fresh install to your Home screen in about two minutes. *Tara's phone (new user).*

**1. Enter your number.** Type your mobile number and tap **Send code**. The note at the bottom is the key idea: people who have your number saved can see the books you share.

<img src="img/f01-01-phone.png" width="260" alt="Welcome screen with the number 9000000004 typed in and a Send code button">

**2. Enter the code.** Type the 6-digit code from the SMS; it submits on the last digit. **Resend code** appears if it doesn't arrive.

<img src="img/f01-02-code.png" width="260" alt="Enter the code screen with six empty boxes, Verify and Resend code">

**3. Tell people your name.** This name shows on your requests to people who haven't saved you.

<img src="img/f01-03-name.png" width="260" alt="What's your name screen with Tara Iyer typed in and a Continue button">

**4. Find your people.** Allow contacts access when Android asks. LendShelf checks only phone numbers to find friends who already use the app. Here nobody was found yet, so it suggests inviting friends on WhatsApp; tap **Continue** to go on.

<img src="img/f01-04-find-people.png" width="260" alt="Find your people result: None of your contacts are on LendShelf yet, with Invite friends on WhatsApp and Continue">

**5. Start from the setup card.** Home shows three setup steps: find your people, add your books and set your pickup spot. Once friends join, their books appear below it.

<img src="img/f01-05-home.png" width="260" alt="Home with the setup card: Your circle is empty for now, three unchecked steps and an Invite friends button">

**6. Add your first books.** My books starts empty with **Scan books**, **Search** and **Type it in**. See [F8](#f8-add-books).

<img src="img/f01-06-mybooks-empty.png" width="260" alt="Empty My books screen titled Scan your shelf with Scan books, Search and Type it in buttons">

## F2 Find a book

**Goal:** find something to read, or check whether anyone you know has a particular book. *Asha's phone.*

**1. Browse Home.** Home shows your circle, books from your wishlist that a friend can lend, and what friends added this week. Each cover says whether it's available.

<img src="img/f02-01-home-feed.jpg" width="260" alt="Home, New this week: Ravi added 6 books, with covers marked Available, Not lending, With you and Lent">

**2. Search "Does anyone have…?"** Type a title or author. Friends' copies come first, with who has them; **Search the catalogue** looks further.

<img src="img/f02-02-search.png" width="260" alt="Home search for hobbit: In your circle, The Hobbit, Available from Ravi Menon">

**3. Open the book page.** **Who has it** lists every copy in your circle with an **Ask** button. Below are the description and reviews from people you know.

<img src="img/f02-03-book-page.jpg" width="260" alt="The Hobbit book page: Who has it, Ravi Menon Available with Ask; Wishlist and I own this buttons">

**4. Or browse a person.** Tap a friend in **Your circle** to see their shelf, their pickup note, and an **Available to borrow** filter.

<img src="img/f02-04-person.jpg" width="260" alt="Ravi Menon's page: pickup note, 6 books, 3 to borrow, and his shelf">

## F3 Ask to borrow

**Goal:** send a borrow request and say hi on WhatsApp. *Asha's phone (borrower).*

**1. Open the copy.** Tap a book in Ravi's shelf (or **Ask** on the book page) and tap **Ask to borrow**.

<img src="img/f03-01-copy-viewer.png" width="260" alt="Ravi Menon's copy of The Hobbit: Available to borrow, Ask to borrow and Message Ravi on WhatsApp">

**2. Add a note and send.** Say when you could pick it up, then tap **Send request**. WhatsApp opens with a ready-made message to Ravi; send it, or come back without sending.

<img src="img/f03-02-ask-sheet.jpg" width="260" alt="Ask to borrow sheet with the note Could I pick it up on Thursday evening? and Send request">

**3. See that it's sent.** The copy now says **Request sent**. If you backed out of WhatsApp, **Message Ravi again** reopens it.

<img src="img/f03-03-request-sent.png" width="260" alt="Copy page showing Requested and Request sent, with Message Ravi again, Open request and Cancel request">

**4. Follow the request.** **Open request** shows the loan screen with your note, the timeline and **Cancel request**. A request expires after 7 days without an answer.

<img src="img/f03-04-loan-requested.png" width="260" alt="Loan screen: Request sent, expires in 7 days, Message Ravi again, Cancel request, timeline You asked">

## F4 Answer a request

**Goal:** say yes or no in a few seconds. *Ravi's phone (owner), except the last step.*

**1. See the request.** It appears at the top of Home and Loans under **Needs you**, with Asha's note and when it expires.

<img src="img/f04-01-request-card.png" width="260" alt="Ravi's Home: card Asha Rao wants The Hobbit with her note, Accept, Decline and a message button">

**2. Accept and pick a due date.** Three weeks is pre-selected; change it with the chips or the − and + buttons. Tap **Lend to Asha**.

<img src="img/f04-02-accept-sheet.png" width="260" alt="Lend to Asha Rao sheet with due date chips, 18 Dec 2026 and a Lend to Asha button">

**3. Tell her on WhatsApp.** Asha sees the yes in LendShelf. **Tell Asha on WhatsApp** opens a ready message with the pickup note and due date.

<img src="img/f04-03-lent-success.png" width="260" alt="Success sheet: Lent to Asha Rao, due 18 Dec, with Tell Asha on WhatsApp and Done">

**4. Wait for the pick-up.** For the first two days Loans shows **Waiting for Asha to pick up**.

<img src="img/f04-04-ravi-loans.png" width="260" alt="Ravi's Loans: Out with friends lists The Hobbit, Waiting for Asha to pick up">

**5. Or decline.** Tap **Decline** on the card. A reason is optional: I'm reading it, Not lending this one, or Lent to someone else.

<img src="img/f04-05-decline-sheet.png" width="260" alt="Decline Asha's request sheet with three reasons, I'm reading it selected, and a red Decline button">

**6. Let her know.** The request closes. **Tell Asha on WhatsApp** is there if you want to add a word.

<img src="img/f04-06-declined.png" width="260" alt="Declined sheet: Asha can see it in LendShelf, Tell Asha on WhatsApp and Done">

**7. What the borrower sees.** *Asha's phone.* Under **Recent**, the declined request shows the reason in words: "Ravi is reading it right now".

<img src="img/f04-07-asha-declined.png" width="260" alt="Asha's Loans, Recent: Siddhartha, Ravi is reading it right now, Declined">

## F5 Pick up, return and confirm

**Goal:** get the book, give it back, and have both sides agree it's back.

**1. Arrange the pick-up.** *Asha's phone.* After Ravi says yes, Home shows **Ravi said yes** with his pickup note and **Message Ravi**.

<img src="img/f05-01-pickup-card.png" width="260" alt="Asha's Home: card Ravi said yes to The Hobbit, Pick up from Ravi, with Message Ravi">

**2. Message the owner.** *Asha's phone.* The loan screen says **Pick up from Ravi**. **Message Ravi** opens WhatsApp. If you change your mind, use **Not picking it up? Tell Ravi**.

<img src="img/f05-02-loan-pickup.png" width="260" alt="Loan screen: Pick up from Ravi with Message Ravi, Not picking it up? Tell Ravi and I've returned it">

**3. Read it.** *Asha's phone.* After the pick-up window the loan says **With you** and the due date.

<img src="img/f05-03-with-you.png" width="260" alt="Loan screen: With you, from Ravi, due 18 Dec, with I've returned it and Ask for more time">

**4. Say you've returned it.** *Asha's phone.* Tap **I've returned it**, then **Yes, I've returned it**.

<img src="img/f05-04-returned-confirm.png" width="260" alt="Dialog: Did you give The Hobbit back to Ravi? Yes, I've returned it / Not yet">

**5. Wait for the owner.** *Asha's phone.* The loan says **Waiting for Ravi to confirm**.

<img src="img/f05-05-waiting-confirm.png" width="260" alt="Loan screen: Waiting for Ravi to confirm, You said you returned it, Message Ravi">

**6. Confirm it's back.** *Ravi's phone (owner).* A **Needs you** card says Asha returned it. Tap **Got it back**, or **Not back yet** if it isn't.

<img src="img/f05-06-says-returned.png" width="260" alt="Ravi's Loans: card Asha Rao says they returned The Hobbit, with Got it back and Not back yet">

**7. Done.** *Ravi's phone.* The loan moves to **Recent** as Returned, and the book is available again.

<img src="img/f05-07-back-on-shelf.png" width="260" alt="Ravi's Loans, Recent: The Hobbit, Back from Asha, Returned">

## F6 Overdue and nudges

**Goal:** get an overdue book back without awkwardness. The borrower gets a reminder the day before the due date; both people get one the day after it and then once a week.

**1. Spot it.** *Ravi's phone (owner).* An overdue card sits at the top of Home with **Nudge on WhatsApp**, **Got it back** and a calendar button to change the date.

<img src="img/f06-01-owner-overdue.png" width="260" alt="Ravi's Home: Animal Farm with Asha Rao, 3 days overdue, Nudge on WhatsApp, Got it back, change date">

**2. Nudge.** *Ravi's phone.* The loan screen offers the same actions. **Nudge on WhatsApp** opens a friendly reminder with the title and due date.

<img src="img/f06-02-owner-loan.png" width="260" alt="Loan screen: 3 days overdue, With Asha, was due 24 Nov, Nudge on WhatsApp and Got it back">

**3. Or give more time.** *Ravi's phone.* Tap the due date row (**Change**), pick +1 week, +2 weeks or +1 month, and **Save due date**. Asha sees the new date.

<img src="img/f06-04-change-due.png" width="260" alt="Change due date sheet with +1 week selected, 4 Dec 2026 and Save due date">

**4. The borrower's side.** *Asha's phone (borrower).* She sees the same card with **I've returned it** and **Ask for more time**, which opens WhatsApp with a polite request for a week more.

<img src="img/f06-03-borrower-overdue.png" width="260" alt="Asha's Home: Animal Farm from Ravi Menon, 3 days overdue, I've returned it and Ask for more time">

## F7 Lend in person

**Goal:** record a book you handed over face to face, even to someone without the app. *Ravi's phone (owner).*

**1. Pick the copy.** Loans › **Lend a book** lists your books. Tap the one you lent.

<img src="img/f07-01-pick-copy.jpg" width="260" alt="Lend a book, Which copy? list of Ravi's books with their status">

**2. Choose who has it.** People on LendShelf are listed. For anyone else, tap **Someone else**.

<img src="img/f07-02-lend.png" width="260" alt="Lend screen for Sapiens: Who's borrowing it? Someone else, Asha Rao On LendShelf, due date chips">

**3. Type their name.** The number is optional. With a number you can message them on WhatsApp, and if they're on LendShelf they see the loan too. Tap **Use this person**.

<img src="img/f07-03-someone-else.png" width="260" alt="Someone else form with the name Nikhil, an optional phone number and Use this person">

**4. Set the due date and lend.** Check the date and tap **Lend to Nikhil**.

<img src="img/f07-04-ready.png" width="260" alt="Lend screen with Nikhil, No number, Back by Fri 18 Dec 2026, and Lend to Nikhil">

**5. Done.** LendShelf now remembers who has it. You can invite Nikhil to the app if you like.

<img src="img/f07-05-lent.png" width="260" alt="Lent to Nikhil: Sapiens is due back 18 Dec, with Invite Nikhil and Done">

**6. See who has your books.** Loans › **Out with friends** lists every book that's out and when it's due.

<img src="img/f07-06-loans.png" width="260" alt="Loans, Out with friends: Animal Farm with Asha due tomorrow, Sapiens with Nikhil due 18 Dec">

**7. When it comes back.** Tap **Got it back** on the row and confirm.

<img src="img/f07-07-got-back-sheet.png" width="260" alt="Dialog: Got Animal Farm back from Asha? It goes back on your shelf and the loan closes, with Yes, it’s back and Cancel">

**8. Back on the shelf.** A message confirms it and the loan moves to **Recent**.

<img src="img/f07-08-back-on-shelf.png" width="260" alt="Toast Back on your shelf, Sapiens is available again; Recent shows Sapiens, Back from Nikhil">

## F8 Add books

**Goal:** get your books into LendShelf quickly. *Ravi's phone.*

**1. Open Add books.** Tap **+** on My books. **Scan** is the default: point the camera at the barcode on the back of each book and LendShelf fills in the title, author and cover. Books without a barcode: use **Search** or **Type it in**.

<img src="img/f08-01-add-search.png" width="260" alt="Add books screen with Search, Scan and Type it in tabs, Search selected">

**2. Search by title.** Pick the right edition from the results.

<img src="img/f08-02-results.jpg" width="260" alt="Search results for The Alchemist with covers, authors and years">

**3. Choose who can see it.** Pick a collection and **Lendable**, **Not lending** or **Hidden**, then tap **Add**.

<img src="img/f08-03-confirm.png" width="260" alt="Add a copy of The Alchemist: Collection chips, Who can see it with Lendable, Not lending and Hidden, and Add to Main shelf">

**4. Done.** Add more, or tap **Done**.

<img src="img/f08-04-added.png" width="260" alt="The Alchemist is on your shelf, Added to Main shelf, Done and Add more books">

## F9 Manage my library

**Goal:** control what friends see and can borrow. *Ravi's phone.*

**1. My books.** Filter by collection or by status (**Out**, **Not lending**, **Hidden**). Every book shows its status in words.

<img src="img/f09-01-mybooks.jpg" width="260" alt="My books grid with collection chips, status chips and books marked Available, Private, Not lending and Out">

**2. Change sharing on a copy.** Open a book. Under **Sharing** choose **Lendable**, **Not lending** (friends see it but can't ask) or **Hidden** (only you). You can also move it to another collection or lend it from here.

<img src="img/f09-02-copy-owner.png" width="260" alt="Your copy of The Hobbit: On your shelf, Lend this copy, Sharing with Lendable, Not lending, Hidden, and Collection">

**3. Collections.** The folder icon on My books opens Collections. Turn **Share with contacts** off to make a collection private, or rename, reorder and delete collections.

<img src="img/f09-03-collections.png" width="260" alt="Collections: Main shelf shared, Ravi private not shared, with Rename and Delete, and New collection">

**4. Delete a copy.** At the bottom of a copy, **Delete this copy** removes it after you confirm. Its loan history and reviews stay. A book that's out can't be deleted until it's back.

<img src="img/f09-04-delete-copy.png" width="260" alt="Dialog: Delete this copy? Piranesi will be removed from your shelves, Delete and Cancel">

## F10 Reviews

**Goal:** tell friends what you thought. *Asha's phone.*

**1. Rate it when you're done.** A closed loan asks **How was it?** Tap a star.

<img src="img/f10-01-how-was-it.png" width="260" alt="Closed loan: Returned to Ravi, How was it? with five empty stars, and the full timeline">

**2. Add a few words.** The text is optional. Tap **Post review**.

<img src="img/f10-02-review.png" width="260" alt="Write a review: five stars, Loved it, and the text A cosy adventure. Perfect for a rainy weekend.">

**3. Saved.** People who have your number saved can see it. Tap a star to change it.

<img src="img/f10-03-after.png" width="260" alt="Loan screen: Your review, five stars, Thanks. Ravi and others can see it.">

**4. On the book page.** Reviews from you and the people you've saved show under **Reviews**, with the average.

<img src="img/f10-04-book-reviews.jpg" width="260" alt="The Hobbit book page: 5.0 from 1 review and the review text">

You can also write a review any time from a book page with **Write a review**.

## F11 Wishlist and notify when back

**Goal:** "I want this. Tell me when I can get it."

**1. Search for a book nobody has.** *Ravi's phone.* If no one in your circle has it, Home shows catalogue results.

<img src="img/f11-01-search-none.png" width="260" alt="Home search for Project Hail Mary: No one in your circle has it, catalogue results with heart buttons">

**2. Tap the heart.** It's on your wishlist.

<img src="img/f11-02-added.jpg" width="260" alt="Toast Added to your wishlist, We'll let you know when someone you know adds it; filled heart">

**3. See your wishlist.** The heart at the top of Home (or Me › Wishlist) lists the books you want and whether anyone has one now.

<img src="img/f11-03-wishlist.png" width="260" alt="Wishlist: Project Hail Mary, No one in your circle has it yet">

**4. When a friend has it.** *Asha's phone.* Home shows **From your wishlist** with **Ask**.

<img src="img/f11-04-from-wishlist.png" width="260" alt="From your wishlist: Siddhartha, Available from Ravi Menon, with Ask">

**5. A book that's lent out.** *Asha's phone.* A friend's copy that's out shows when it's due back. Tap **Notify me when it's back**.

<img src="img/f11-05-lent-copy.png" width="260" alt="Ravi Menon's copy of Sapiens: Lent, back 18 Dec, Notify me when it's back">

**6. You'll be told.** The button changes to **Stop notifying me**. When the book comes back you get a notification and can ask.

<img src="img/f11-06-notify-on.png" width="260" alt="The same copy with Stop notifying me">

## F12 Notifications

**Goal:** know what needs you, with or without push.

**1. Needs you.** *Ravi's phone.* Everything waiting on you is at the top of Loans (and the first two on Home). The Loans tab badge counts them.

<img src="img/f12-01-needs-you.jpg" width="260" alt="Ravi's Loans: Needs you (3) with an overdue card, a returned card and a request card; Loans badge 3">

**2. The rest of the ledger.** *Asha's phone.* Below Needs you: **With you**, **Your requests**, then **Recent** with closed and declined loans.

<img src="img/f12-02-asha-loans.png" width="260" alt="Asha's Loans: Needs you, With you, Your requests sections">

**3. Push notifications.** The first time you ask, accept or wishlist something, LendShelf asks "Get told when…?" before Android's own permission prompt. Check the state any time in Me › Notifications.

<img src="img/f12-03-push-on.png" width="260" alt="Me, Notifications: Push notifications On">

Push needs the EAS project set up (see the README). Until then, the dev build shows every update in the app but sends no push messages.

## F13 Profile, contacts and pickup note

**Goal:** keep your name, pickup spot and circle up to date. *Ravi's phone.*

**1. Me.** The profile card shows your name, number and pickup note. **Contacts** and **Sync now** keep your circle current; **Invite friends** shares a WhatsApp invite.

<img src="img/f13-01-me.png" width="260" alt="Me: Ravi Menon, +91 90000 00002, pickup note, Contacts section and Library section">

**2. Edit your profile.** Tap **Edit** to change your name and pickup note. The note shows on your books and in WhatsApp messages, so borrowers know where and when.

<img src="img/f13-02-edit-profile.png" width="260" alt="Edit profile sheet: Name Ravi Menon, Pickup note Indiranagar, weekday evenings after 7, Save">

**3. How contacts work.** Me › Contacts explains what's checked (numbers only) and has **Sync now** for when you've saved someone new.

<img src="img/f13-03-contacts.png" width="260" alt="Contacts screen: Only numbers are checked, Owners don't see who saved them, Names you know, Sync now">

## F14 Export

**Goal:** keep your own copy of your books and loans. *Ravi's phone.*

**1. Open Export.** Me › **Export**.

<img src="img/f14-01-me-export.png" width="260" alt="Me scrolled down: Export, Notifications, Appearance, About, Sign out and Delete account">

**2. Pick a format.** **Spreadsheet (CSV)** has one row per book. **Full backup (JSON)** has books, collections, loan history and your reviews. The file is made on your phone and Android's share sheet opens so you can save or send it.

<img src="img/f14-02-export-sheet.png" width="260" alt="Export your data sheet: Spreadsheet (CSV) and Full backup (JSON)">

**3. Before you leave.** Deleting your account offers the same export first.

<img src="img/f15-02-delete-precheck.png" width="260" alt="Before you delete your account sheet with Export your books and loan history first">

## F15 Sign out and delete account

**Goal:** leave cleanly.

**1. Sign out.** *Ravi's phone.* Me › **Sign out**, then confirm. Your books and loans stay; sign in with the same number to get them back.

<img src="img/f15-01-signout-dialog.png" width="260" alt="Dialog: Sign out? Your books and loans stay safe, Sign out and Cancel">

**2. Delete account: check first.** *Tara's phone.* Me › **Delete account** says what will be removed and what happens to your loans, with an export button. Tap **Continue**.

<img src="img/f15-02-delete-precheck.png" width="260" alt="Before you delete your account: what will be removed, You have no open loans or requests, Export, Continue and Cancel">

**3. Confirm.** Type DELETE and tap **Delete everything**. This can't be undone. Friends who have your books see that you left, and people who lent you a book keep your name and number on their record.

<img src="img/f15-03-delete-confirm.png" width="260" alt="Delete your account? dialog with DELETE typed and Delete everything">

**4. Gone.** The app returns to the Welcome screen.

<img src="img/f15-04-welcome.png" width="260" alt="Welcome to LendShelf screen with an empty number field">
