/**
 * Seed the RUNNING emulators with demo data.
 *
 *   npm --prefix functions run serve     # terminal 1
 *   npm --prefix functions run seed      # terminal 2
 *
 * Wipes Firestore and Auth emulator data first, so it is idempotent. Background
 * triggers are paused while it wipes and writes (QA B5): otherwise the delete
 * triggers from the wipe run seconds later and cancel the seeded requests.
 * Needs no network: all book data (real Open Library works) is hardcoded.
 */
const PROJECT_ID = "demo-lendshelf";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
const HUB_HOST = process.env.FIREBASE_EMULATOR_HUB ?? "127.0.0.1:4400";
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.GCLOUD_PROJECT = PROJECT_ID;

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  COL,
  defaultShelfId,
  linkId,
  olWorkId,
  reviewId,
  watchId,
  type BookFormat,
  type ClosedReason,
  type DeclineReason,
  type IsbnIndexDoc,
  type ItemDoc,
  type LinkDoc,
  type LoanDoc,
  type ProfileDoc,
  type ReviewDoc,
  type ShelfDoc,
  type UserDoc,
  type Visibility,
  type WatchDoc,
  type WorkDoc,
} from "../src/model.js";
import { computeSharedWithContacts } from "../src/lib/sharing.js";

const DAY = 86_400_000;
const NOW = Date.now();
const ago = (days: number): Timestamp => Timestamp.fromMillis(NOW - days * DAY);

// ---- books (real Open Library works) --------------------------------------------

interface SeedWork {
  code: string;
  key: string;
  title: string;
  authors: string[];
  cover: number;
  year: number;
  isbn: string;
  publisher: string | null;
  pubYear: number | null;
}

const W = (
  code: string, key: string, title: string, authors: string[], cover: number, year: number,
  isbn: string, publisher: string | null, pubYear: number | null,
): SeedWork => ({ code, key, title, authors, cover, year, isbn, publisher, pubYear });

const WORKS: SeedWork[] = [
  W("hobbit", "OL27482W", "The Hobbit", ["J.R.R. Tolkien"], 14627509, 1937, "9780547928227", "Mariner Books", 2012),
  W("dune", "OL893414W", "Dune", ["Frank Herbert"], 11481354, 1965, "9780441013593", "Ace", 2005),
  W("pride", "OL66554W", "Pride and Prejudice", ["Jane Austen"], 14348537, 1813, "9780141439518", "Penguin Books", 2003),
  W("gatsby", "OL468431W", "The Great Gatsby", ["F. Scott Fitzgerald"], 10590366, 1925, "9780743273565", "Scribner", 2004),
  W("mockingbird", "OL3140822W", "To Kill a Mockingbird", ["Harper Lee"], 14351077, 1960, "9780061120084", "Harper Perennial Modern Classics", 2006),
  W("f451", "OL103123W", "Fahrenheit 451", ["Ray Bradbury"], 12993656, 1953, "9781451673319", "Simon & Schuster", 2013),
  W("bnw", "OL64365W", "Brave New World", ["Aldous Huxley"], 8231823, 1932, "9780060850524", "Harper Perennial", 2006),
  W("gost", "OL1052133W", "The God of Small Things", ["Arundhati Roy"], 10513792, 1997, "9780679457312", "Random House", 1997),
  W("midnight", "OL457179W", "Midnight's Children", ["Salman Rushdie"], 8346713, 1981, "9780812976533", "Random House Trade Paperbacks", 2006),
  W("suitable", "OL11930W", "A Suitable Boy", ["Vikram Seth"], 911254, 1993, "9780060786526", "Harper Perennial Modern Classics", 2005),
  W("tiger", "OL13493080W", "The White Tiger", ["Aravind Adiga"], 9679064, 2008, "9781416562597", "Free Press", 2008),
  W("sapiens", "OL17075811W", "Sapiens", ["Yuval Noah Harari"], 8634250, 2011, "9780062316097", "Harper", 2015),
  W("hp1", "OL82563W", "Harry Potter and the Philosopher's Stone", ["J. K. Rowling"], 15155833, 1997, "9780747532699", "Bloomsbury Publishing", 1997),
  W("malgudi", "OL1057177W", "Malgudi Days", ["R. K. Narayan"], 7981639, 1943, "9780143039655", "Penguin Books", 2006),
  W("guide", "OL1057183W", "The Guide", ["R. K. Narayan"], 97546, 1958, "9780143039648", "Penguin Books", 2006),
  W("habits", "OL17930368W", "Atomic Habits", ["James Clear"], 12539702, 2018, "9780735211292", "Avery", 2018),
  W("thinking", "OL15992072W", "Thinking, Fast and Slow", ["Daniel Kahneman"], 13290711, 2011, "9780374533557", "Farrar, Straus and Giroux", 2013),
  W("kite", "OL5781992W", "The Kite Runner", ["Khaled Hosseini"], 14846827, 2003, "9781594631931", "Riverhead Books", 2013),
  W("animal", "OL1168007W", "Animal Farm", ["George Orwell"], 11261770, 1945, "9780451526342", "Signet Classics", 1996),
  W("1984", "OL1168083W", "Nineteen Eighty-Four", ["George Orwell"], 9267242, 1949, "9780451524935", "Signet Classic", 1984),
  W("inheritance", "OL97945W", "The Inheritance of Loss", ["Kiran Desai"], 5728169, 2006, "9780802142818", "Grove Press", 2006),
  W("martian", "OL17091839W", "The Martian", ["Andy Weir"], 11447888, 2011, "9780553418026", "Broadway Books", 2014),
  W("phm", "OL21745884W", "Project Hail Mary", ["Andy Weir"], 11200092, 2021, "9780593135204", "Ballantine Books", 2021),
  W("wind", "OL8479867W", "The Name of the Wind", ["Patrick Rothfuss"], 11480483, 2007, "9780756404079", "DAW Books", 2007),
  W("alchemist", "OL796465W", "The Alchemist", ["Paulo Coelho"], 7414780, 1988, "9780062315007", "HarperCollins", 2014),
  W("solitude", "OL274505W", "One Hundred Years of Solitude", ["Gabriel García Márquez"], 12627383, 1967, "9780060883287", "Harper Perennial Modern Classics", 2006),
  W("prince", "OL10263W", "The Little Prince", ["Antoine de Saint-Exupéry"], 10708272, 1943, "9780156012195", "Harcourt", 2000),
  W("palace", "OL20668662W", "The Palace of Illusions", ["Chitra Banerjee Divakaruni"], 9336727, 2008, "9780307472496", "Vintage", 2009),
];
const WORK_BY_CODE = new Map(WORKS.map((w) => [w.code, w]));
const coverUrl = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;

const CUSTOM_WORK_ID = "custom_seedzoya1";
const CUSTOM_WORK = {
  title: "Nani's Recipe Notebook",
  authors: ["Zoya Khan"],
  description: "Hand-written family recipes, bound and photocopied for the cousins.",
};

// ---- people ---------------------------------------------------------------------

interface SeedUser {
  key: "asha" | "ravi" | "meera" | "kabir" | "zoya";
  uid: string;
  name: string;
  phone: string;
  pickupNote: string | null;
  shelves: { id: string; name: string; isPublic: boolean }[];
  /** [workCode, shelfIndex, visibility, format] */
  copies: [string, number, Visibility?, BookFormat?][];
  saved: SeedUser["key"][];
}

const USERS: SeedUser[] = [
  {
    key: "asha", uid: "demo-asha", name: "Asha Rao", phone: "+919000000001", pickupNote: "Indiranagar, weekday evenings",
    shelves: [
      { id: defaultShelfId("demo-asha"), name: "My books", isPublic: true },
      { id: "shelf-asha-kids", name: "Kids' shelf", isPublic: true },
      { id: "shelf-asha-private", name: "Private", isPublic: false },
    ],
    copies: [
      ["hobbit", 0], ["dune", 0], ["sapiens", 0], ["pride", 0, "visible", "hardcover"], ["gatsby", 0],
      ["mockingbird", 0], ["habits", 0, "visible"], ["midnight", 0], ["suitable", 0, "hidden", "hardcover"],
      ["alchemist", 0], ["hp1", 1], ["prince", 1], ["malgudi", 1], ["kite", 2], ["thinking", 2], ["inheritance", 2],
    ],
    saved: ["ravi", "meera", "kabir"], // not Zoya: Zoya -> Asha is one-way
  },
  {
    key: "ravi", uid: "demo-ravi", name: "Ravi Menon", phone: "+919000000002", pickupNote: "Koramangala, weekends",
    shelves: [
      { id: defaultShelfId("demo-ravi"), name: "My books", isPublic: true },
      { id: "shelf-ravi-scifi", name: "Sci-fi", isPublic: true },
    ],
    copies: [
      ["hobbit", 0, "lendable", "hardcover"], ["dune", 1], ["phm", 1], ["martian", 1], ["f451", 1], ["bnw", 1],
      ["1984", 1], ["animal", 0], ["tiger", 0], ["guide", 0], ["kite", 0, "visible"], ["wind", 0],
      ["sapiens", 0, "hidden"], ["solitude", 0],
    ],
    saved: ["asha", "meera", "kabir", "zoya"],
  },
  {
    key: "meera", uid: "demo-meera", name: "Meera Iyer", phone: "+919000000003", pickupNote: null,
    shelves: [{ id: defaultShelfId("demo-meera"), name: "My books", isPublic: true }],
    copies: [
      ["gost", 0], ["sapiens", 0], ["phm", 0], ["inheritance", 0], ["midnight", 0, "visible"], ["palace", 0],
      ["malgudi", 0], ["pride", 0], ["alchemist", 0], ["thinking", 0], ["hp1", 0], ["mockingbird", 0, "visible"],
    ],
    saved: ["asha", "ravi", "kabir", "zoya"],
  },
  {
    key: "kabir", uid: "demo-kabir", name: "Kabir Shah", phone: "+919000000004", pickupNote: "Office, Mon-Fri",
    shelves: [
      { id: defaultShelfId("demo-kabir"), name: "My books", isPublic: true },
      { id: "shelf-kabir-office", name: "Office", isPublic: false },
    ],
    copies: [
      ["habits", 0], ["hobbit", 0], ["sapiens", 0, "visible"], ["thinking", 0], ["1984", 0], ["gatsby", 0],
      ["martian", 0], ["tiger", 0, "visible"], ["kite", 0], ["guide", 0], ["wind", 0], ["dune", 0],
      ["f451", 1], ["bnw", 1], ["animal", 1],
    ],
    saved: ["asha", "ravi", "meera", "zoya"],
  },
  {
    key: "zoya", uid: "demo-zoya", name: "Zoya Khan", phone: "+919000000005", pickupNote: "Jayanagar",
    shelves: [
      { id: defaultShelfId("demo-zoya"), name: "My books", isPublic: true },
      { id: "shelf-zoya-classics", name: "Poetry & classics", isPublic: true },
    ],
    copies: [
      ["solitude", 0], ["prince", 0], ["gost", 0], ["palace", 0], ["alchemist", 0], ["suitable", 0, "hidden"],
      ["pride", 1], ["gatsby", 1], ["animal", 1], ["mockingbird", 1], ["midnight", 1],
      [CUSTOM_WORK_ID, 0, "visible", "other"],
    ],
    saved: ["asha", "ravi", "meera", "kabir"],
  },
];
const U = Object.fromEntries(USERS.map((u) => [u.key, u])) as Record<SeedUser["key"], SeedUser>;

const itemId = (u: SeedUser, workCode: string) => `item-${u.key}-${workCode}`;

// ---- emulator plumbing -----------------------------------------------------------

async function assertEmulatorsUp(): Promise<void> {
  for (const [name, url] of [
    ["Firestore", `http://${FIRESTORE_HOST}/`],
    ["Auth", `http://${AUTH_HOST}/`],
  ] as const) {
    try {
      await fetch(url);
    } catch {
      throw new Error(`${name} emulator isn't running at ${url}. Start it with: npm --prefix functions run serve`);
    }
  }
}

async function wipe(): Promise<void> {
  const r1 = await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  const r2 = await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  if (!r1.ok || !r2.ok) throw new Error(`Wiping emulators failed (firestore ${r1.status}, auth ${r2.status})`);
}

/**
 * Pauses or resumes Cloud Functions background triggers in the emulator suite
 * (Emulator Hub API). Events written while paused are never delivered. Returns
 * false when the hub or the Functions emulator isn't running (nothing to pause).
 */
async function setBackgroundTriggers(enabled: boolean): Promise<boolean> {
  const action = enabled ? "enableBackgroundTriggers" : "disableBackgroundTriggers";
  try {
    const r = await fetch(`http://${HUB_HOST}/functions/${action}`, { method: "PUT" });
    return r.ok;
  } catch {
    return false;
  }
}

// ---- main ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await assertEmulatorsUp();
  const paused = await setBackgroundTriggers(false);
  try {
    await seed();
  } finally {
    if (paused && !(await setBackgroundTriggers(true))) {
      console.error(`Couldn't resume background triggers. Run: curl -X PUT http://${HUB_HOST}/functions/enableBackgroundTriggers`);
    }
  }
}

async function seed(): Promise<void> {
  await wipe();

  const app = initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore(app);
  const auth = getAuth(app);
  const writer = db.bulkWriter();
  const set = (col: string, id: string, data: object) => void writer.set(db.collection(col).doc(id), data);

  // Auth users (onUserCreated is paused; the seed writes profiles and phoneIndex itself).
  for (const u of USERS) {
    await auth.createUser({ uid: u.uid, phoneNumber: u.phone, displayName: u.name });
  }

  // Works + ISBN index
  for (const w of WORKS) {
    const work: WorkDoc = {
      category: "book", source: "openlibrary", title: w.title, authors: w.authors, description: null,
      coverUrl: coverUrl(w.cover), firstPublishYear: w.year, isCustom: false, createdBy: null,
      createdAt: ago(60), updatedAt: ago(60),
    };
    set(COL.works, olWorkId(w.key), work);
    const index: IsbnIndexDoc = {
      workId: olWorkId(w.key),
      edition: { isbn: w.isbn, coverUrl: coverUrl(w.cover), language: "en", publisher: w.publisher, publishYear: w.pubYear },
    };
    set(COL.isbnIndex, w.isbn, index);
  }
  const custom: WorkDoc = {
    category: "book", source: "custom", title: CUSTOM_WORK.title, authors: CUSTOM_WORK.authors,
    description: CUSTOM_WORK.description, coverUrl: null, firstPublishYear: null, isCustom: true,
    createdBy: U.zoya.uid, createdAt: ago(40), updatedAt: ago(40),
  };
  set(COL.works, CUSTOM_WORK_ID, custom);

  // Users, profiles, phoneIndex, shelves, items
  const items = new Map<string, ItemDoc>();
  USERS.forEach((u, ui) => {
    const joined = ago(50 - ui * 5);
    set(COL.users, u.uid, { phone: u.phone, pushTokens: [], createdAt: joined } satisfies UserDoc);
    set(COL.profiles, u.uid, { name: u.name, pickupNote: u.pickupNote, createdAt: joined, updatedAt: joined } satisfies ProfileDoc);
    set(COL.phoneIndex, u.phone, { uid: u.uid });
    u.shelves.forEach((s, i) => {
      set(COL.shelves, s.id, { ownerId: u.uid, name: s.name, isPublic: s.isPublic, sortOrder: i, createdAt: joined, updatedAt: joined } satisfies ShelfDoc);
    });
    u.copies.forEach(([code, shelfIdx, visibility = "lendable", format = "paperback"], i) => {
      const shelf = u.shelves[shelfIdx];
      if (!shelf) throw new Error(`Bad shelf index for ${u.key}/${code}`);
      const isCustom = code === CUSTOM_WORK_ID;
      const w = WORK_BY_CODE.get(code);
      if (!isCustom && !w) throw new Error(`Unknown work ${code}`);
      const created = ago(45 - ui * 5 - i * 0.5);
      const item: ItemDoc = {
        ownerId: u.uid,
        workId: isCustom ? CUSTOM_WORK_ID : olWorkId((w as SeedWork).key),
        category: "book",
        shelfId: shelf.id,
        visibility,
        sharedWithContacts: computeSharedWithContacts(shelf.isPublic, visibility),
        title: isCustom ? CUSTOM_WORK.title : (w as SeedWork).title,
        authors: isCustom ? CUSTOM_WORK.authors : (w as SeedWork).authors,
        coverUrl: isCustom ? null : coverUrl((w as SeedWork).cover),
        isCustom,
        isbn: isCustom ? null : (w as SeedWork).isbn,
        format,
        language: "en",
        loanState: "available",
        dueDate: null,
        activeLoanId: null,
        createdAt: created,
        updatedAt: created,
      };
      items.set(itemId(u, isCustom ? "custom" : code), item);
    });
  });

  // Links (viewer has owner saved). Zoya has Asha, Asha doesn't have Zoya.
  let linkCount = 0;
  for (const viewer of USERS) {
    for (const ownerKey of viewer.saved) {
      const owner = U[ownerKey];
      set(COL.links, linkId(viewer.uid, owner.uid), {
        viewerId: viewer.uid, ownerId: owner.uid, ownerPhone: owner.phone, createdAt: ago(30),
      } satisfies LinkDoc);
      linkCount++;
    }
  }

  // Loans in every state
  type LoanSpec = {
    id: string; owner: SeedUser; work: string; borrower: SeedUser | { name: string; phone: string | null };
    status: LoanDoc["status"]; message?: string; requested?: number; started?: number; due?: number;
    marked?: number; returned?: number; declineReason?: DeclineReason; closedReason?: ClosedReason;
  };
  const LOANS: LoanSpec[] = [
    { id: "loan-requested", owner: U.asha, work: "sapiens", borrower: U.ravi, status: "requested", requested: 1, message: "Could I borrow this after you're done? Happy to pick it up Saturday." },
    // A second open request for the same copy (Asha chooses between Ravi and Kabir).
    { id: "loan-requested-2", owner: U.asha, work: "sapiens", borrower: U.kabir, status: "requested", requested: 2, message: "Would love to read this next!" },
    { id: "loan-active", owner: U.ravi, work: "phm", borrower: U.meera, status: "active", requested: 6, started: 5, due: -16 },
    { id: "loan-due-soon", owner: U.ravi, work: "martian", borrower: U.zoya, status: "active", requested: 20, started: 19, due: -2 },
    { id: "loan-overdue", owner: U.meera, work: "gost", borrower: U.kabir, status: "active", requested: 31, started: 30, due: 9 },
    { id: "loan-return-pending", owner: U.kabir, work: "habits", borrower: U.asha, status: "returnPending", requested: 21, started: 20, due: -1, marked: 1 },
    { id: "loan-returned", owner: U.asha, work: "dune", borrower: U.zoya, status: "returned", requested: 40, started: 39, due: 18, returned: 10 },
    { id: "loan-non-app", owner: U.asha, work: "hp1", borrower: { name: "Nikhil (neighbour)", phone: "+919812345678" }, status: "active", started: 14, due: -7 },
    { id: "loan-declined", owner: U.zoya, work: "solitude", borrower: U.kabir, status: "declined", requested: 12, declineReason: "readingIt" },
    // Kabir asked for Project Hail Mary at the same time as Meera; Ravi lent it to Meera (Kabir has a back-watch).
    { id: "loan-declined-lent", owner: U.ravi, work: "phm", borrower: U.kabir, status: "declined", requested: 6, declineReason: "lentToSomeoneElse" },
    // Accepted but never picked up; Asha closed it as not collected.
    { id: "loan-not-collected", owner: U.asha, work: "gatsby", borrower: U.meera, status: "cancelled", requested: 15, started: 14, due: -7, closedReason: "notCollected" },
    { id: "loan-cancelled", owner: U.asha, work: "hobbit", borrower: U.meera, status: "cancelled", requested: 9 },
    { id: "loan-expired", owner: U.zoya, work: "prince", borrower: U.ravi, status: "expired", requested: 10 },
  ];
  for (const l of LOANS) {
    const iid = itemId(l.owner, l.work);
    const item = items.get(iid);
    if (!item) throw new Error(`Loan ${l.id}: ${l.owner.key} has no ${l.work}`);
    const isUser = "uid" in l.borrower;
    const b = l.borrower as SeedUser;
    const dueDate = l.due !== undefined ? ago(l.due) : null;
    const loan: LoanDoc = {
      itemId: iid, workId: item.workId, ownerId: l.owner.uid, ownerName: l.owner.name, ownerPhone: l.owner.phone,
      borrowerUid: isUser ? b.uid : null,
      borrowerName: l.borrower.name,
      borrowerPhone: isUser ? b.phone : (l.borrower as { phone: string | null }).phone,
      title: item.title, coverUrl: item.coverUrl, status: l.status, message: l.message ?? null, dueDate,
      requestedAt: l.requested !== undefined ? ago(l.requested) : null,
      startedAt: l.started !== undefined ? ago(l.started) : null,
      returnMarkedAt: l.marked !== undefined ? ago(l.marked) : null,
      returnedAt: l.returned !== undefined ? ago(l.returned) : null,
      updatedAt: ago(Math.min(...[l.requested, l.started, l.marked, l.returned].filter((x): x is number => x !== undefined))),
      ...(l.declineReason ? { declineReason: l.declineReason } : {}),
      ...(l.closedReason ? { closedReason: l.closedReason } : {}),
    };
    set(COL.loans, l.id, loan);
    if (l.status === "active" || l.status === "returnPending") {
      item.loanState = "lent";
      item.activeLoanId = l.id;
      item.dueDate = dueDate;
    }
  }
  // Owner left: Dev Patel (no longer on the app) lent Meera Animal Farm, then deleted his account.
  // His user, profile and copy are gone; the loan keeps his name with the phone blanked.
  const ownerLeftLoan: LoanDoc = {
    itemId: "item-dev-animal", workId: olWorkId("OL1168007W"), ownerId: "demo-dev-left", ownerName: "Dev Patel", ownerPhone: "",
    borrowerUid: U.meera.uid, borrowerName: U.meera.name, borrowerPhone: U.meera.phone,
    title: "Animal Farm", coverUrl: coverUrl(11261770), status: "ownerLeft", message: null, dueDate: ago(-5),
    requestedAt: ago(18), startedAt: ago(17), returnMarkedAt: null, returnedAt: null, updatedAt: ago(2),
  };
  set(COL.loans, "loan-owner-left", ownerLeftLoan);
  for (const [id, item] of items) set(COL.items, id, item);

  // Reviews (only on works the author can plausibly have read)
  const REVIEWS: [SeedUser, string, number, string | null][] = [
    [U.asha, "hobbit", 5, "Read it aloud to the kids over a month. Still magic."],
    [U.ravi, "hobbit", 4, "Lighter than LOTR, in a good way."],
    [U.kabir, "hobbit", 4, null],
    [U.ravi, "dune", 5, "The world-building is unmatched. Push through the first 100 pages."],
    [U.zoya, "dune", 4, "Dense but rewarding. Thanks for the loan, Asha!"],
    [U.asha, "sapiens", 3, "Big ideas, a bit breezy on the evidence."],
    [U.meera, "sapiens", 4, "Great conversation starter."],
    [U.ravi, "phm", 5, "Rocky! Best sci-fi I've read in years."],
    [U.meera, "phm", 5, "Couldn't put it down."],
    [U.meera, "gost", 5, "Every sentence is a little gift."],
    [U.kabir, "gost", 4, "Beautiful, but take it slow."],
    [U.kabir, "habits", 4, "Practical. The 2-minute rule actually works."],
    [U.asha, "habits", 3, "Useful, could have been half the length."],
    [U.zoya, "solitude", 5, null],
  ];
  for (const [u, code, rating, text] of REVIEWS) {
    const w = WORK_BY_CODE.get(code) as SeedWork;
    const wid = olWorkId(w.key);
    set(COL.reviews, reviewId(wid, u.uid), {
      workId: wid, authorId: u.uid, authorName: u.name, rating, text, createdAt: ago(8), updatedAt: ago(8),
    } satisfies ReviewDoc);
  }

  // Watches
  const WATCHES: [SeedUser, "wishlist" | "back", string, string][] = [
    [U.zoya, "wishlist", olWorkId("OL15992072W"), "thinking"],
    [U.ravi, "wishlist", olWorkId("OL20668662W"), "palace"],
    [U.asha, "wishlist", olWorkId("OL8479867W"), "wind"],
    [U.meera, "back", itemId(U.asha, "hp1"), "hp1"],
    [U.kabir, "back", itemId(U.ravi, "phm"), "phm"], // created by the server when his request was declined
  ];
  for (const [u, type, targetId, code] of WATCHES) {
    const w = WORK_BY_CODE.get(code) as SeedWork;
    set(COL.watches, watchId(u.uid, type, targetId), {
      uid: u.uid, type, targetId, workId: olWorkId(w.key), title: w.title, createdAt: ago(3),
    } satisfies WatchDoc);
  }

  await writer.close();

  // ---- summary ----
  const line = (s: string) => console.log(s);
  line("");
  line("LendShelf demo data seeded into the emulators (project demo-lendshelf).");
  line("");
  line("  Name         Phone            uid          Shelves  Copies  Has saved");
  for (const u of USERS) {
    line(
      `  ${u.name.padEnd(12)} ${u.phone.padEnd(16)} ${u.uid.padEnd(12)} ${String(u.shelves.length).padStart(7)}  ${String(u.copies.length).padStart(6)}  ${u.saved.map((k) => U[k].name.split(" ")[0]).join(", ")}`,
    );
  }
  line("");
  line(`  works ${WORKS.length + 1} (1 custom), items ${items.size}, links ${linkCount}, loans ${LOANS.length + 1}, reviews ${REVIEWS.length}, watches ${WATCHES.length}`);
  line("  loans: " + [...LOANS.map((l) => l.id), "loan-owner-left"].map((id) => id.replace("loan-", "")).join(", "));
  line("  one-way link: Zoya has Asha saved; Asha does not have Zoya.");
  line("");
  line("Sign in with any number above. The Auth emulator issues the SMS code:");
  line(`  curl http://${AUTH_HOST}/emulator/v1/projects/${PROJECT_ID}/verificationCodes`);
  line("");
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
