/**
 * WhatsApp messages for loans (others live in `@/lib/whatsapp`). Every message greets the
 * other person by their *profile* first name via `greeting()` (R21): pass a profile name or
 * null, never the name saved in my contacts.
 */
import { Linking } from 'react-native';

import { addDays, formatShortDate, toDate, type DateInput } from '@/lib/dates';
import { toast } from '@/lib/toast';
import { greeting, nudgeMessage, waLink } from '@/lib/whatsapp';
import type { DeclineReason } from '@/types/model';

type Name = string | null | undefined;

const quoted = (title: string) => `“${title.trim()}”`;
const pickupLine = (note: string | null | undefined) =>
  note?.trim() ? ` Pickup: ${note.trim()}.` : '';

/** Owner → borrower about an incoming request (before deciding, e.g. to agree a pickup). */
export function requestReplyMessage(borrowerProfileName: Name, title: string): string {
  return `${greeting(borrowerProfileName)} Saw your request for ${quoted(title)} on LendShelf.`;
}

/** Borrower → owner, following up on a pending request ("Message Ravi again"). */
export function requestFollowUpMessage(ownerProfileName: Name, title: string): string {
  return `${greeting(ownerProfileName)} I've asked to borrow ${quoted(title)} on LendShelf. Would that work?`;
}

/** Owner → borrower after accepting ("Tell Zoya on WhatsApp", E5). */
export function acceptedMessage(input: {
  borrowerName: Name;
  title: string;
  dueDate: DateInput;
  pickupNote?: string | null;
}): string {
  return `${greeting(input.borrowerName)} Yes, you can borrow ${quoted(input.title)}!${pickupLine(
    input.pickupNote
  )} Due back ${formatShortDate(input.dueDate)}.`;
}

/** Owner → borrower after declining ("Tell Zoya on WhatsApp", E5), with the reason prefilled. */
export function declinedMessage(input: {
  borrowerName: Name;
  title: string;
  reason?: DeclineReason | null;
}): string {
  const t = quoted(input.title);
  let body: string;
  switch (input.reason) {
    case 'readingIt':
      body = `Sorry, I'm reading ${t} myself right now.`;
      break;
    case 'notLending':
      body = `Sorry, I'm not lending ${t} at the moment.`;
      break;
    case 'lentToSomeoneElse':
      body = `Sorry, ${t} just went to someone else.`;
      break;
    default:
      body = `Sorry, I can't lend ${t} right now.`;
  }
  return `${greeting(input.borrowerName)} ${body}`;
}

/**
 * Owner → a requester whose request was declined because the copy went to someone else
 * ("Tell Kabir on WhatsApp" on the accept success sheet, E5).
 */
export function wentElsewhereMessage(input: {
  borrowerName: Name;
  title: string;
  backAround?: DateInput | null;
}): string {
  const back = input.backAround
    ? ` It should be back around ${formatShortDate(input.backAround)}.`
    : '';
  return `${greeting(input.borrowerName)} Sorry, ${quoted(input.title)} just went to someone else.${back}`;
}

/** Owner → borrower in the pick-up window ("Message Asha"). */
export function pickupOwnerMessage(input: {
  borrowerName: Name;
  title: string;
  pickupNote?: string | null;
}): string {
  return `${greeting(input.borrowerName)} ${quoted(input.title)} is ready for you.${pickupLine(
    input.pickupNote
  )} When would you like to pick it up?`;
}

/** Borrower → owner in the pick-up window ("Message Ravi"). */
export function pickupBorrowerMessage(input: { ownerName: Name; title: string }): string {
  return `${greeting(input.ownerName)} Thanks for lending me ${quoted(input.title)}! When can I pick it up?`;
}

/** Borrower → owner: "Not picking it up? Tell Ravi". */
export function notPickingUpMessage(input: { ownerName: Name; title: string }): string {
  return `${greeting(input.ownerName)} Sorry, I won't be able to pick up ${quoted(input.title)} after all. Thanks anyway!`;
}

/** Borrower → owner: "Ask for more time" (E6), proposing the due date + 1 week. */
export function moreTimeMessage(input: {
  ownerName: Name;
  title: string;
  dueDate: DateInput | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const base = input.dueDate && toDate(input.dueDate) > now ? input.dueDate : now;
  const until = formatShortDate(addDays(base, 7), now);
  return `${greeting(input.ownerName)} Could I keep ${quoted(input.title)} a little longer? Maybe till ${until}?`;
}

/** Owner → borrower after changing the due date ("Tell Zoya on WhatsApp", E6). */
export function dueChangedMessage(input: {
  borrowerName: Name;
  title: string;
  dueDate: DateInput;
  /** The due date before the change: an earlier new date reads as a request, not "no problem". */
  previousDue?: DateInput | null;
}): string {
  const date = formatShortDate(input.dueDate);
  if (input.previousDue && toDate(input.dueDate) < toDate(input.previousDue)) {
    return `${greeting(input.borrowerName)} Could I have ${quoted(input.title)} back by ${date}? I've changed the due date on LendShelf.`;
  }
  return `${greeting(input.borrowerName)} No problem, keep ${quoted(input.title)} till ${date}.`;
}

/** Owner → borrower after "Not back yet" (E6). */
export function notBackYetMessage(input: { borrowerName: Name; title: string }): string {
  return `${greeting(input.borrowerName)} I don't think I've got ${quoted(input.title)} back yet. Could you check?`;
}

/** Borrower → owner after the owner said "Not back yet" (E4: P "Message Ravi"). */
export function notBackYetReplyMessage(input: { ownerName: Name; title: string }): string {
  return `${greeting(input.ownerName)} You said ${quoted(input.title)} isn't back yet. I'll check and get back to you.`;
}

/** Owner → borrower before deleting the account (E15 pre-check). */
export function leavingMessage(input: { borrowerName: Name; title: string }): string {
  return `${greeting(input.borrowerName)} I'm leaving LendShelf. You've still got my ${quoted(
    input.title
  )}, could you drop it back when you're done?`;
}

/** Either side, a plain opener about a loan (the Loan screen's other-party Message button). */
export function loanChatMessage(input: { name: Name; title: string }): string {
  return `${greeting(input.name)} About ${quoted(input.title)} on LendShelf:`;
}

/** Owner → borrower reminder for a loan (wording from `nudgeMessage`, which adapts to overdue). */
export function nudgeLoanMessage(
  borrowerName: Name,
  loan: { title: string; dueDate: DateInput | null }
): string {
  return nudgeMessage({ borrowerName, title: loan.title, dueDate: loan.dueDate });
}

/** Opens WhatsApp; shows a toast when it can't be opened. */
export async function openWhatsApp(phoneE164: string, text: string): Promise<void> {
  try {
    await Linking.openURL(waLink(phoneE164, text));
  } catch {
    toast.error('Couldn’t open WhatsApp.');
  }
}
