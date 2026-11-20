/**
 * WhatsApp deep links (`https://wa.me/<digits>?text=...`) and the prefilled messages
 * LendShelf sends. WhatsApp is where people talk; the app only prepares the message.
 */
import { formatShortDate, dueState, type DateInput } from '@/lib/dates';
import { phoneDigits } from '@/lib/phone';

/** wa.me link for an E.164 number, optionally with a prefilled message. */
export function waLink(phoneE164: string, text?: string): string {
  const base = `https://wa.me/${phoneDigits(phoneE164)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();
const quoted = (title: string) => `“${title.trim()}”`;

export interface AskMessageInput {
  ownerName: string;
  title: string;
  /** Optional note the borrower typed with the request. */
  note?: string | null;
}

/** Borrower → owner, sent after creating a borrow request. */
export function askMessage({ ownerName, title, note }: AskMessageInput): string {
  const lines = [
    `Hi ${firstName(ownerName)}! Could I borrow ${quoted(title)}? I've sent a request on LendShelf.`,
  ];
  const trimmed = note?.trim();
  if (trimmed) lines.push('', trimmed);
  return lines.join('\n');
}

export interface NudgeMessageInput {
  borrowerName: string;
  title: string;
  dueDate: DateInput | null;
  now?: Date;
}

/** Owner → borrower reminder. Wording depends on whether the book is overdue. */
export function nudgeMessage({
  borrowerName,
  title,
  dueDate,
  now = new Date(),
}: NudgeMessageInput): string {
  const hi = `Hi ${firstName(borrowerName)}!`;
  if (!dueDate) {
    return `${hi} Hope you're enjoying ${quoted(title)}. Let me know when you're done with it.`;
  }
  const state = dueState(dueDate, now);
  const when = formatShortDate(dueDate, now);
  if (state.kind === 'overdue') {
    return `${hi} Just a reminder that ${quoted(title)} was due back on ${when}. Could you return it when you get a chance?`;
  }
  if (state.kind === 'today') {
    return `${hi} Just a reminder that ${quoted(title)} is due back today. No stress if you need a few more days, just let me know.`;
  }
  return `${hi} Just a reminder that ${quoted(title)} is due back on ${when}. No rush, just let me know if you need longer.`;
}

export interface ReturnMessageInput {
  ownerName: string;
  title: string;
}

/** Borrower → owner, when they're done and want to hand the book back. */
export function returnMessage({ ownerName, title }: ReturnMessageInput): string {
  return `Hi ${firstName(ownerName)}! I've finished ${quoted(title)}, thank you! When's a good time to drop it back?`;
}

/** Generic opener about a copy (the "Message on WhatsApp" button). */
export function aboutBookMessage({
  ownerName,
  title,
}: {
  ownerName: string;
  title: string;
}): string {
  return `Hi ${firstName(ownerName)}! I saw ${quoted(title)} on your LendShelf.`;
}
