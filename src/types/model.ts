/**
 * Firestore data model (SPEC §3). Field names match the documents exactly.
 *
 * Types are SDK-neutral: timestamps are typed structurally (`TimestampLike`) so the same types
 * work with the Firebase JS SDK (web) and React Native Firebase (native).
 * Documents read from Firestore are returned as `WithId<T>` (see `fromSnap`).
 */

/** Structural type satisfied by both SDKs' `Timestamp`. */
export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export type Category = 'book';

// ---------- users/{uid} (private) ----------
export interface UserDoc {
  phone: string;
  pushTokens: string[];
  createdAt: TimestampLike;
}

// ---------- profiles/{uid} ----------
export interface Profile {
  name: string;
  pickupNote: string | null;
  /** false hides my reading from my contacts; missing (older profiles) means shared. */
  shareReading?: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- links/{viewerId}_{ownerId} ----------
export interface Link {
  viewerId: string;
  ownerId: string;
  ownerPhone: string;
  createdAt: TimestampLike;
}

// ---------- works/{workId} ----------
export type WorkSource = 'openlibrary' | 'googlebooks' | 'custom';

export interface Work {
  category: Category;
  source: WorkSource;
  title: string;
  authors: string[];
  description: string | null;
  coverUrl: string | null;
  firstPublishYear: number | null;
  isCustom: boolean;
  /** uid of the creator; custom books only. */
  createdBy: string | null;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- shelves/{shelfId} ----------
export interface Shelf {
  ownerId: string;
  name: string;
  isPublic: boolean;
  sortOrder: number;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- items/{itemId} ----------
export type Visibility = 'lendable' | 'visible' | 'hidden';
export type ItemFormat = 'paperback' | 'hardcover' | 'other';
export type LoanState = 'available' | 'lent';

export interface Item {
  ownerId: string;
  workId: string;
  category: Category;
  shelfId: string;
  visibility: Visibility;
  /** Derived: shelf.isPublic && visibility !== 'hidden'. Enforced by rules. */
  sharedWithContacts: boolean;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isCustom: boolean;
  isbn: string | null;
  format: ItemFormat | null;
  language: string | null;
  /** Backend only. */
  loanState: LoanState;
  /** Backend only. */
  dueDate: TimestampLike | null;
  /** Backend only. */
  activeLoanId: string | null;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

/** Fields the backend owns; clients must not set them (rules enforce defaults on create). */
export type ItemBackendField = 'loanState' | 'dueDate' | 'activeLoanId';

// ---------- loans/{loanId} ----------
export type LoanStatus =
  | 'requested'
  | 'declined'
  | 'cancelled'
  | 'expired'
  | 'active'
  | 'returnPending'
  | 'returned'
  /** The owner deleted their account while the borrower had the book. Terminal; no reminders. */
  | 'ownerLeft';

/**
 * Why a request was declined. Optional when the owner declines; the server sets
 * 'lentToSomeoneElse' (and a back-watch) when another request is accepted or the copy is lent by hand.
 */
export type DeclineReason = 'readingIt' | 'notLending' | 'lentToSomeoneElse';
/** Why a loan was closed without a return (status 'cancelled'). */
export type ClosedReason = 'notCollected' | 'copyRemoved';
/** `confirmReturn({ reason })`: 'returned' (default) or 'notCollected' (never picked up). */
export type ConfirmReturnReason = 'returned' | 'notCollected';

export interface Loan {
  itemId: string;
  workId: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  /** null when the borrower isn't on the app. */
  borrowerUid: string | null;
  borrowerName: string;
  borrowerPhone: string | null;
  title: string;
  coverUrl: string | null;
  status: LoanStatus;
  message: string | null;
  dueDate: TimestampLike | null;
  requestedAt: TimestampLike | null;
  startedAt: TimestampLike | null;
  returnMarkedAt: TimestampLike | null;
  returnedAt: TimestampLike | null;
  updatedAt: TimestampLike;
  /** Only on 'declined' loans, when a reason was given or set by the server. Absent on older loans. */
  declineReason?: DeclineReason | null;
  /** Only on loans closed without a return ('cancelled' + 'notCollected'). */
  closedReason?: ClosedReason | null;
  /**
   * Set when the owner said "Not back yet" (returnPending -> active); cleared
   * when the borrower marks it returned again or the loan closes.
   */
  notBackYetAt?: TimestampLike | null;
  /**
   * Every "I've returned it" and "Not back yet", oldest first (the fields above are cleared or
   * overwritten when it goes back and forth). Absent on older loans.
   */
  returnEvents?: { kind: 'returnMarked' | 'notBackYet'; at: TimestampLike }[];
  /** When the owner last moved the due date. */
  dueChangedAt?: TimestampLike | null;
  /** The due date before the first change (timeline: "Accepted (due 12 Dec)"). */
  firstDueDate?: TimestampLike | null;
  /** Set when the borrower deleted their account (`borrowerUid` is then null). */
  borrowerLeftAt?: TimestampLike | null;
}

export const OPEN_LOAN_STATUSES: readonly LoanStatus[] = ['requested', 'active', 'returnPending'];
export const CLOSED_LOAN_STATUSES: readonly LoanStatus[] = [
  'declined',
  'cancelled',
  'expired',
  'returned',
  'ownerLeft',
];

// ---------- reviews/{workId}_{uid} ----------
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Review {
  workId: string;
  authorId: string;
  authorName: string;
  rating: Rating;
  text: string | null;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- readings/{workId}_{uid} ----------
/** 'reading' now, or 'finished' (in the Read list). */
export type ReadingStatus = 'reading' | 'finished';

export interface Reading {
  workId: string;
  uid: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  status: ReadingStatus;
  /**
   * When the current (or last) read started. Null for a moment on this device after a write
   * (serverTimestamp() not confirmed yet), as is finishedAt right after "Finished it".
   */
  startedAt: TimestampLike | null;
  /** When it was last finished; kept while re-reading. */
  finishedAt: TimestampLike | null;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- watches/{uid}_{type}_{targetId} ----------
export type WatchType = 'wishlist' | 'back';

export interface Watch {
  uid: string;
  /** 'wishlist' → targetId is a workId; 'back' → targetId is an itemId. */
  type: WatchType;
  targetId: string;
  workId: string;
  title: string;
  createdAt: TimestampLike;
}

// ---------- Collection names and document ids ----------

export const COLLECTIONS = {
  users: 'users',
  profiles: 'profiles',
  links: 'links',
  works: 'works',
  shelves: 'shelves',
  items: 'items',
  loans: 'loans',
  reviews: 'reviews',
  readings: 'readings',
  watches: 'watches',
} as const;

export const linkId = (viewerId: string, ownerId: string) => `${viewerId}_${ownerId}`;
export const reviewId = (workId: string, uid: string) => `${workId}_${uid}`;
export const readingId = (workId: string, uid: string) => `${workId}_${uid}`;
export const watchId = (uid: string, type: WatchType, targetId: string) =>
  `${uid}_${type}_${targetId}`;

export const DEFAULT_SHELF_NAME = 'My books';
/** Every user's default shelf "My books" has a fixed id. */
export const defaultShelfId = (uid: string) => `default_${uid}`;
export const DEFAULT_LOAN_DAYS = 21;
export const REQUEST_EXPIRY_DAYS = 7;
/** How many books someone can be reading at once (checked on device). */
export const MAX_READING = 5;

export const LIMITS = {
  profileName: 60,
  pickupNote: 200,
  shelfName: 40,
  reviewText: 2000,
  syncContacts: 5000,
} as const;

// ---------- Helpers ----------

export type WithId<T> = T & { id: string };

/** Minimal structural type of a document snapshot in either SDK. */
export interface SnapLike {
  id: string;
  exists(): boolean;
  data(): unknown;
}

/** `value` as a list of strings: non-arrays become `[]`, non-string entries are dropped. */
export function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Defensive clean-up of fields the UI relies on. Rules validate writes, but documents written
 * before a rule existed (or by hand) may not match: `authors` (items, works) must be `string[]`.
 */
function sanitiseDoc(data: unknown): Record<string, unknown> {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return 'authors' in d ? { ...d, authors: toStringList(d.authors) } : d;
}

/**
 * Converts a document snapshot into `WithId<T>`, or `null` if it doesn't exist.
 * Firestore data is trusted to match the model (rules validate writes), apart from the
 * defensive `authors` coercion in `sanitiseDoc`.
 */
export function fromSnap<T>(snap: SnapLike): WithId<T> | null {
  if (!snap.exists()) return null;
  return { ...(sanitiseDoc(snap.data()) as T), id: snap.id };
}

/** Converts every document of a query snapshot. */
export function fromQuerySnap<T>(snap: { docs: readonly SnapLike[] }): WithId<T>[] {
  return snap.docs.map((d) => ({ ...(sanitiseDoc(d.data()) as T), id: d.id }));
}

/** Whether a copy is shown to contacts given its shelf (mirrors the rules). */
export function isSharedWithContacts(shelfIsPublic: boolean, visibility: Visibility): boolean {
  return shelfIsPublic && visibility !== 'hidden';
}

/** What the Add flow knows when creating a copy. */
export interface NewItemInput {
  ownerId: string;
  workId: string;
  shelfId: string;
  /** Needed to derive `sharedWithContacts`. */
  shelfIsPublic: boolean;
  visibility: Visibility;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isCustom: boolean;
  isbn: string | null;
  format: ItemFormat | null;
  language: string | null;
}

/**
 * Builds a new `items/{itemId}` document with exactly the 18 fields the rules accept:
 * backend-owned loan fields at their defaults and `sharedWithContacts` derived from the shelf.
 * Pass the SDK's `serverTimestamp()` as `now`.
 */
export function buildNewItem<TS>(
  input: NewItemInput,
  now: TS
): Omit<Item, 'createdAt' | 'updatedAt' | 'dueDate'> & {
  dueDate: null;
  createdAt: TS;
  updatedAt: TS;
} {
  return {
    ownerId: input.ownerId,
    workId: input.workId,
    category: 'book',
    shelfId: input.shelfId,
    visibility: input.visibility,
    sharedWithContacts: isSharedWithContacts(input.shelfIsPublic, input.visibility),
    title: input.title,
    authors: input.authors,
    coverUrl: input.coverUrl,
    isCustom: input.isCustom,
    isbn: input.isbn,
    format: input.format,
    language: input.language,
    loanState: 'available',
    dueDate: null,
    activeLoanId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Display status of a copy as seen by anyone. */
export type ItemStatus =
  | { kind: 'available' }
  /** `withMe`: I'm the borrower ("With you" rather than "Lent out"). */
  | { kind: 'lent'; dueDate: Date | null; withMe?: boolean }
  | { kind: 'requested' }
  | { kind: 'notLendable' }
  /** Only the owner ever sees a hidden copy. */
  | { kind: 'hidden' };

export function itemStatus(
  item: Pick<Item, 'loanState' | 'dueDate' | 'visibility'>,
  opts: { requestedByMe?: boolean; borrowedByMe?: boolean } = {}
): ItemStatus {
  if (item.loanState === 'lent') {
    const dueDate = item.dueDate?.toDate() ?? null;
    return opts.borrowedByMe ? { kind: 'lent', dueDate, withMe: true } : { kind: 'lent', dueDate };
  }
  if (opts.requestedByMe) return { kind: 'requested' };
  if (item.visibility === 'hidden') return { kind: 'hidden' };
  if (item.visibility !== 'lendable') return { kind: 'notLendable' };
  return { kind: 'available' };
}
