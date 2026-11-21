/**
 * WhatsApp deep links (`https://wa.me/<digits>?text=...`) and the prefilled messages
 * LendShelf sends. WhatsApp is where people talk; the app only prepares the message.
 */
import { formatShortDate, dueState, type DateInput } from '@/lib/dates';
import { phoneDigits } from '@/lib/phone';
import { shortName } from '@/features/shared/people';

/** wa.me link for an E.164 number, optionally with a prefilled message. */
export function waLink(phoneE164: string, text?: string): string {
  const base = `https://wa.me/${phoneDigits(phoneE164)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Opening of every outgoing message (UX F6, C1): the person's *profile* first name
 * ("Hi Ravi!"), else "Hi!". Never pass the name saved in my contacts: a contact saved as
 * "Dr. Mehta" is still greeted by the name they chose on LendShelf.
 */
export function greeting(profileName: string | null | undefined): string {
  // First word of the profile name, but a profile name that starts with a title stays whole
  // ("Dr. Mehta" → "Hi Dr. Mehta!", never "Hi Dr.!").
  // The greeting is to that one person, so it isn't widened to tell circle names apart.
  const first = typeof profileName === 'string' ? shortName(profileName, []) : '';
  return first ? `Hi ${first}!` : 'Hi!';
}

const quoted = (title: string) => `“${title.trim()}”`;

export interface AskMessageInput {
  /** The owner's profile name (not their saved contact name); null greets with "Hi!". */
  ownerName: string | null | undefined;
  title: string;
  /** Optional note the borrower typed with the request. */
  note?: string | null;
}

/** Borrower → owner, sent after creating a borrow request. */
export function askMessage({ ownerName, title, note }: AskMessageInput): string {
  const lines = [
    `${greeting(ownerName)} Could I borrow ${quoted(title)}? I've sent a request on LendShelf.`,
  ];
  const trimmed = note?.trim();
  if (trimmed) lines.push('', trimmed);
  return lines.join('\n');
}

export interface NudgeMessageInput {
  /** The borrower's profile name (not a saved contact name); null greets with "Hi!". */
  borrowerName: string | null | undefined;
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
  const hi = greeting(borrowerName);
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
  /** The owner's profile name (not their saved contact name); null greets with "Hi!". */
  ownerName: string | null | undefined;
  title: string;
}

/** Borrower → owner, when they're done and want to hand the book back. */
export function returnMessage({ ownerName, title }: ReturnMessageInput): string {
  return `${greeting(ownerName)} I've finished ${quoted(title)}, thank you! When's a good time to drop it back?`;
}

/** Generic opener about a copy (the "Message on WhatsApp" button). */
export function aboutBookMessage({
  ownerName,
  title,
}: {
  /** The owner's profile name (not their saved contact name); null greets with "Hi!". */
  ownerName: string | null | undefined;
  title: string;
}): string {
  return `${greeting(ownerName)} I saw ${quoted(title)} on your LendShelf.`;
}

/**
 * The profile name to greet a loan's borrower with. `profileName` (their current profile) wins;
 * otherwise the loan's `borrowerName` only when the loan came from their own request (the server
 * copied it from their profile). A name the owner typed when lending by hand is a saved
 * nickname, so it greets with "Hi!".
 */
export function borrowerGreetName(
  loan: { borrowerUid: string | null; borrowerName: string; requestedAt: unknown },
  profileName?: string | null
): string | null {
  if (!loan.borrowerUid) return null;
  if (profileName?.trim()) return profileName;
  return loan.requestedAt ? loan.borrowerName : null;
}
