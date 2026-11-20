/**
 * Firestore data model for LendShelf. Mirrors SPEC.md §3.
 *
 * Every document type is generic over its timestamp type so the same shapes
 * can be reused by the admin SDK (firebase-admin Timestamp), the client SDKs
 * and plain-JSON fixtures.
 */
import type { Timestamp } from "firebase-admin/firestore";

export type Category = "book";
export type Visibility = "lendable" | "visible" | "hidden";
export type WorkSource = "openlibrary" | "googlebooks" | "custom";
export type BookFormat = "paperback" | "hardcover" | "other";
export type LoanState = "available" | "lent";
export type LoanStatus =
  | "requested"
  | "declined"
  | "cancelled"
  | "expired"
  | "active"
  | "returnPending"
  | "returned";
export type WatchType = "wishlist" | "back";

export const VISIBILITIES: readonly Visibility[] = ["lendable", "visible", "hidden"];
export const LOAN_STATUSES: readonly LoanStatus[] = [
  "requested",
  "declined",
  "cancelled",
  "expired",
  "active",
  "returnPending",
  "returned",
];
/** Loans that still involve the item (block deletion, block new loans). */
export const OPEN_LOAN_STATUSES: readonly LoanStatus[] = ["requested", "active", "returnPending"];

export const REGION = "asia-south1";
export const TIME_ZONE = "Asia/Kolkata";
export const REQUEST_TTL_DAYS = 7;
export const DEFAULT_LOAN_DAYS = 21;
export const DEFAULT_SHELF_NAME = "My books";

/** Collection names. `_testPushes` exists only in the emulator. */
export const COL = {
  users: "users",
  profiles: "profiles",
  phoneIndex: "phoneIndex",
  links: "links",
  works: "works",
  isbnIndex: "isbnIndex",
  shelves: "shelves",
  items: "items",
  loans: "loans",
  reviews: "reviews",
  watches: "watches",
  testPushes: "_testPushes",
} as const;

/** `users/{uid}` — private to the user. */
export interface UserDoc<T = Timestamp> {
  phone: string;
  pushTokens: string[];
  createdAt: T;
}

/** `profiles/{uid}` — readable by any signed-in user. */
export interface ProfileDoc<T = Timestamp> {
  name: string;
  pickupNote: string | null;
  createdAt: T;
  updatedAt: T;
}

/** `phoneIndex/{e164}` — backend only. */
export interface PhoneIndexDoc {
  uid: string;
}

/** `links/{viewerId}_{ownerId}` — the viewer has the owner's number saved. */
export interface LinkDoc<T = Timestamp> {
  viewerId: string;
  ownerId: string;
  ownerPhone: string;
  createdAt: T;
}

/** `works/{workId}` — the Book. */
export interface WorkDoc<T = Timestamp> {
  category: Category;
  source: WorkSource;
  title: string;
  authors: string[];
  description: string | null;
  coverUrl: string | null;
  firstPublishYear: number | null;
  isCustom: boolean;
  createdBy: string | null;
  createdAt: T;
  updatedAt: T;
}

/** A work without its timestamps, as returned by `resolveBook`. */
export type WorkData = Omit<WorkDoc, "createdAt" | "updatedAt">;

/** Edition details for one ISBN (returned by `resolveBook`, cached in `isbnIndex`). */
export interface EditionInfo {
  isbn: string | null;
  coverUrl: string | null;
  language: string | null;
  publisher: string | null;
  publishYear: number | null;
}

/** `isbnIndex/{isbn13}` — backend only. `edition` is a cache of the edition details. */
export interface IsbnIndexDoc {
  workId: string;
  edition?: EditionInfo;
}

/** `shelves/{shelfId}` — a user's collection. */
export interface ShelfDoc<T = Timestamp> {
  ownerId: string;
  name: string;
  isPublic: boolean;
  sortOrder: number;
  createdAt: T;
  updatedAt: T;
}

/** `items/{itemId}` — a copy. */
export interface ItemDoc<T = Timestamp> {
  ownerId: string;
  workId: string;
  category: Category;
  shelfId: string;
  visibility: Visibility;
  /** Derived: shelf.isPublic && visibility != "hidden". Enforced by rules. */
  sharedWithContacts: boolean;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isCustom: boolean;
  isbn: string | null;
  format: BookFormat | null;
  language: string | null;
  /** Backend only. */
  loanState: LoanState;
  /** Backend only. */
  dueDate: T | null;
  /** Backend only. */
  activeLoanId: string | null;
  createdAt: T;
  updatedAt: T;
}

/** `loans/{loanId}` — all writes go through callable functions. */
export interface LoanDoc<T = Timestamp> {
  itemId: string;
  workId: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  borrowerUid: string | null;
  borrowerName: string;
  borrowerPhone: string | null;
  title: string;
  coverUrl: string | null;
  status: LoanStatus;
  message: string | null;
  dueDate: T | null;
  requestedAt: T | null;
  startedAt: T | null;
  returnMarkedAt: T | null;
  returnedAt: T | null;
  updatedAt: T;
}

/** `reviews/{workId}_{uid}`. */
export interface ReviewDoc<T = Timestamp> {
  workId: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string | null;
  createdAt: T;
  updatedAt: T;
}

/** `watches/{uid}_{type}_{targetId}` — private to `uid`. */
export interface WatchDoc<T = Timestamp> {
  uid: string;
  type: WatchType;
  /** workId for "wishlist", itemId for "back". */
  targetId: string;
  workId: string;
  title: string;
  createdAt: T;
}

/** Record written in the emulator instead of calling the Expo push API. */
export interface TestPushDoc<T = Timestamp> {
  uids: string[];
  title: string;
  body: string;
  data: Record<string, string>;
  tokenCount: number;
  createdAt: T;
}

// ---- id helpers -----------------------------------------------------------

export const linkId = (viewerId: string, ownerId: string): string => `${viewerId}_${ownerId}`;
export const reviewId = (workId: string, uid: string): string => `${workId}_${uid}`;
export const watchId = (uid: string, type: WatchType, targetId: string): string =>
  `${uid}_${type}_${targetId}`;
export const defaultShelfId = (uid: string): string => `default_${uid}`;
export const olWorkId = (olWorkKey: string): string => `ol_${olWorkKey}`;
export const gbWorkId = (volumeId: string): string => `gb_${volumeId}`;
