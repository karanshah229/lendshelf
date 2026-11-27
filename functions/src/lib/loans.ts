/** Pure loan state-machine helpers (no Firestore). */
import { HttpsError } from "./errors.js";
import {
  DEFAULT_LOAN_DAYS,
  OPEN_LOAN_STATUSES,
  REQUEST_TTL_DAYS,
  type LoanStatus,
} from "../model.js";

export type LoanAction =
  | "accept"
  | "decline"
  | "cancel"
  | "expire"
  | "markReturned"
  | "confirmReturn"
  | "notCollected"
  | "markNotReturned"
  | "updateDueDate"
  | "ownerLeave";

export type LoanActor = "owner" | "borrower" | "system";

interface Transition {
  from: readonly LoanStatus[];
  /** null = status unchanged. */
  to: LoanStatus | null;
  actor: LoanActor;
}

export const TRANSITIONS: Readonly<Record<LoanAction, Transition>> = {
  accept: { from: ["requested"], to: "active", actor: "owner" },
  decline: { from: ["requested"], to: "declined", actor: "owner" },
  cancel: { from: ["requested"], to: "cancelled", actor: "borrower" },
  expire: { from: ["requested"], to: "expired", actor: "system" },
  markReturned: { from: ["active"], to: "returnPending", actor: "borrower" },
  confirmReturn: { from: ["active", "returnPending"], to: "returned", actor: "owner" },
  /** confirmReturn({ reason: "notCollected" }): the borrower never picked it up. */
  notCollected: { from: ["active"], to: "cancelled", actor: "owner" },
  /** "Not back yet": the owner disputes the borrower's "I've returned it". */
  markNotReturned: { from: ["returnPending"], to: "active", actor: "owner" },
  updateDueDate: { from: ["active"], to: null, actor: "owner" },
  /** deleteAccount: the owner left while the borrower had the book. */
  ownerLeave: { from: ["active", "returnPending"], to: "ownerLeft", actor: "system" },
};

const STATUS_WORDS: Record<LoanStatus, string> = {
  requested: "still a request",
  declined: "already declined",
  cancelled: "already cancelled",
  expired: "expired",
  active: "an active loan",
  returnPending: "waiting for the owner to confirm the return",
  returned: "already returned",
  ownerLeft: "closed because the owner left LendShelf",
};

export function isOpenStatus(status: LoanStatus): boolean {
  return OPEN_LOAN_STATUSES.includes(status);
}

export function canTransition(status: LoanStatus, action: LoanAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

/** Next status for an action, or a `failed-precondition` error explaining why not. */
export function nextStatus(status: LoanStatus, action: LoanAction): LoanStatus {
  const t = TRANSITIONS[action];
  if (!t.from.includes(status)) {
    throw new HttpsError(
      "failed-precondition",
      `Can't ${ACTION_WORDS[action]}: this loan is ${STATUS_WORDS[status]}.`,
    );
  }
  return t.to ?? status;
}

const ACTION_WORDS: Record<LoanAction, string> = {
  accept: "accept this request",
  decline: "decline this request",
  cancel: "cancel this request",
  expire: "expire this request",
  markReturned: "mark this book as returned",
  confirmReturn: "confirm the return",
  notCollected: "close this loan as not collected",
  markNotReturned: "say the book isn't back yet",
  updateDueDate: "change the due date",
  ownerLeave: "close this loan",
};

/** The caller's role on a loan. */
export function loanRole(
  loan: { ownerId: string; borrowerUid: string | null },
  uid: string,
): "owner" | "borrower" | null {
  if (loan.ownerId === uid) return "owner";
  if (loan.borrowerUid !== null && loan.borrowerUid === uid) return "borrower";
  return null;
}

/** Throws `permission-denied` unless `uid` may perform `action` on the loan. */
export function assertActor(
  loan: { ownerId: string; borrowerUid: string | null },
  uid: string,
  action: LoanAction,
): void {
  const need = TRANSITIONS[action].actor;
  const role = loanRole(loan, uid);
  if (role === null) throw new HttpsError("permission-denied", "This isn't your loan.");
  if (need !== role) {
    throw new HttpsError(
      "permission-denied",
      need === "owner"
        ? `Only the owner can ${ACTION_WORDS[action]}.`
        : `Only the borrower can ${ACTION_WORDS[action]}.`,
    );
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Due date for a loan: the given ISO date/time, or `now + 21 days`.
 * Must not be in the past (a date-only value for today is fine) and at most a year ahead.
 *
 * A date-only value ("2026-12-12", sent by Accept and Change due date) means
 * that calendar day in India, stored as noon IST like the Lend screen's due
 * dates. Read as UTC midnight (05:30 IST), the 09:00 daily job sent "Overdue"
 * on the due day itself and "Due soon" two days early instead of the day before.
 */
export function resolveDueDate(iso: string | null | undefined, now: Date): Date {
  if (iso === undefined || iso === null || iso === "") return addDays(now, DEFAULT_LOAN_DAYS);
  const dateOnly = DATE_ONLY.test(iso);
  const d = new Date(dateOnly ? `${iso}T12:00:00+05:30` : iso);
  if (Number.isNaN(d.getTime())) {
    throw new HttpsError("invalid-argument", `dueDate "${iso}" isn't a valid date (use ISO 8601).`);
  }
  if (dateOnly ? iso < isoDayIst(now) : d.getTime() < now.getTime() - DAY_MS) {
    throw new HttpsError("invalid-argument", "The due date can't be in the past.");
  }
  if (d.getTime() > addDays(now, 366).getTime()) {
    throw new HttpsError("invalid-argument", "The due date must be within a year.");
  }
  return d;
}

/** A request older than 7 days has expired. */
export function isRequestExpired(requestedAt: Date, now: Date): boolean {
  return now.getTime() - requestedAt.getTime() >= REQUEST_TTL_DAYS * DAY_MS;
}

export function requestExpiryCutoff(now: Date): Date {
  return addDays(now, -REQUEST_TTL_DAYS);
}

export type ReminderKind = "dueSoon" | "overdue";

/**
 * Which reminder (if any) the daily job sends for an active loan.
 * - `dueSoon`: due in more than 1 and at most 2 days (sent once).
 * - `overdue`: on the first day it is overdue, then every 7 days.
 */
export function reminderKind(dueDate: Date, now: Date): ReminderKind | null {
  const diff = dueDate.getTime() - now.getTime();
  if (diff > DAY_MS && diff <= 2 * DAY_MS) return "dueSoon";
  if (diff <= 0) {
    const daysOver = Math.floor(-diff / DAY_MS);
    return daysOver % 7 === 0 ? "overdue" : null;
  }
  return null;
}

const isoDayIst = (d: Date): string => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Whole calendar days from `now` to `due` in India time (0 = today, 1 = tomorrow). */
export function daysUntil(due: Date, now: Date): number {
  return Math.round((Date.parse(isoDayIst(due)) - Date.parse(isoDayIst(now))) / DAY_MS);
}

/** "12 Dec" style short date in India time, for push text. */
export function shortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}
