/** Push notification texts. Pure functions; `data.type` lets the app route taps. */
import type { PushMessage } from "./push.js";
import { daysUntil, shortDate } from "./loans.js";
import type { DeclineReason } from "../model.js";

function declineBody(ownerName: string, title: string, reason: DeclineReason | null): string {
  switch (reason) {
    case "readingIt":
      return `${ownerName} is reading ${title} right now.`;
    case "notLending":
      return `${ownerName} isn't lending ${title} at the moment.`;
    case "lentToSomeoneElse":
      return `${title} went to someone else. We'll tell you when it's back.`;
    default:
      return `${ownerName} can't lend ${title} right now.`;
  }
}

export const msg = {
  loanRequested: (borrowerName: string, title: string, loanId: string): PushMessage => ({
    title: "Borrow request",
    body: `${borrowerName} would like to borrow ${title}.`,
    data: { type: "loanRequested", loanId },
  }),
  requestAccepted: (ownerName: string, title: string, loanId: string, due: Date): PushMessage => ({
    title: "Request accepted",
    body: `${ownerName} is lending you ${title}. Due back ${shortDate(due)}.`,
    data: { type: "requestAccepted", loanId },
  }),
  /** Text depends on the reason; `data.reason` is set when there is one. */
  requestDeclined: (ownerName: string, title: string, loanId: string, reason?: DeclineReason | null): PushMessage => ({
    title: "Request declined",
    body: declineBody(ownerName, title, reason ?? null),
    data: reason ? { type: "requestDeclined", loanId, reason } : { type: "requestDeclined", loanId },
  }),
  lentToYou: (ownerName: string, title: string, loanId: string, due: Date): PushMessage => ({
    title: "Book lent to you",
    body: `${ownerName} lent you ${title}. Due back ${shortDate(due)}.`,
    data: { type: "lentToYou", loanId },
  }),
  markedReturned: (borrowerName: string, title: string, loanId: string): PushMessage => ({
    title: "Book returned?",
    body: `${borrowerName} says they've returned ${title}. Confirm when you have it.`,
    data: { type: "markedReturned", loanId },
  }),
  reviewPrompt: (title: string, workId: string, loanId: string): PushMessage => ({
    title: "How was it?",
    body: `Thanks for returning ${title}. Leave a quick review?`,
    data: { type: "reviewPrompt", workId, loanId },
  }),
  itemBack: (ownerName: string, title: string, itemId: string): PushMessage => ({
    title: "Book is back",
    body: `${ownerName}'s ${title} is available again.`,
    data: { type: "itemBack", itemId },
  }),
  wishlistAdded: (ownerName: string, title: string, itemId: string, workId: string): PushMessage => ({
    title: "On your wishlist",
    body: `${ownerName} added ${title}.`,
    data: { type: "wishlistAdded", itemId, workId },
  }),
  requestExpired: (title: string, loanId: string): PushMessage => ({
    title: "Request expired",
    body: `Your request to borrow ${title} expired without a reply.`,
    data: { type: "requestExpired", loanId },
  }),
  dueSoon: (title: string, loanId: string, due: Date, now: Date): PushMessage => {
    const days = daysUntil(due, now);
    const when = days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    return {
      title: "Due soon",
      body: `${title} is due back ${when} (${shortDate(due)}).`,
      data: { type: "dueSoon", loanId },
    };
  },
  itemRemoved: (ownerName: string, title: string, loanId: string): PushMessage => ({
    title: "Request cancelled",
    body: `${ownerName} removed ${title}.`,
    data: { type: "itemRemoved", loanId },
  }),
  overdueBorrower: (title: string, loanId: string, due: Date): PushMessage => ({
    title: "Overdue",
    body: `${title} was due back ${shortDate(due)}. Please return it soon.`,
    data: { type: "overdue", loanId, role: "borrower" },
  }),
  overdueOwner: (borrowerName: string, title: string, loanId: string, due: Date): PushMessage => ({
    title: "Overdue",
    body: `${borrowerName} still has ${title} (due ${shortDate(due)}). Send a nudge?`,
    data: { type: "overdue", loanId, role: "owner" },
  }),
  /** To back-watchers when a loan is closed as not collected (instead of itemBack). */
  availableAgain: (title: string, itemId: string): PushMessage => ({
    title: "Available again",
    body: `${title} is available again.`,
    data: { type: "availableAgain", itemId },
  }),
  /** To the borrower when the owner says "Not back yet" (returnPending -> active). */
  notBackYet: (ownerName: string, title: string, loanId: string): PushMessage => ({
    title: "Not back yet",
    body: `${ownerName} hasn't got ${title} back yet.`,
    data: { type: "notBackYet", loanId },
  }),
  dueChanged: (ownerName: string, title: string, loanId: string, due: Date): PushMessage => ({
    title: "Due date changed",
    body: `${ownerName} changed the due date for ${title} to ${shortDate(due)}.`,
    data: { type: "dueChanged", loanId },
  }),
  /** To the borrower when the owner deletes their account while the borrower has the book. */
  ownerLeft: (ownerName: string, title: string, loanId: string): PushMessage => ({
    title: `${ownerName} left LendShelf`,
    body: `If you still have ${title}, message them on WhatsApp if you still have their number.`,
    data: { type: "ownerLeft", loanId },
  }),
};
