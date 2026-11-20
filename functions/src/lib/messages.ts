/** Push notification texts. Pure functions; `data.type` lets the app route taps. */
import type { PushMessage } from "./push.js";
import { daysUntil, shortDate } from "./loans.js";

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
  requestDeclined: (ownerName: string, title: string, loanId: string): PushMessage => ({
    title: "Request declined",
    body: `${ownerName} can't lend ${title} right now.`,
    data: { type: "requestDeclined", loanId },
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
};
