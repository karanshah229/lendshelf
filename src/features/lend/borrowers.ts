/**
 * Borrower choices for the Lend screen: people on LendShelf I have saved, then the rest of my
 * phone contacts, filtered by one search box. Also the WhatsApp message sent after lending.
 */
import { formatShortDate } from '@/lib/dates';
import { normaliseText } from '@/lib/search';
import { greeting } from '@/lib/whatsapp';

export interface Borrower {
  name: string;
  /** E.164, or null for someone without a number. */
  phone: string | null;
  /** Set when they're on LendShelf (from my links). */
  uid: string | null;
}

export interface BorrowerOptions {
  onApp: Borrower[];
  contacts: Borrower[];
}

const matches = (b: Borrower, q: string, qDigits: string) =>
  normaliseText(b.name).includes(q) ||
  (qDigits.length >= 3 && !!b.phone && b.phone.replace(/\D/g, '').includes(qDigits));

/**
 * Splits people into "On LendShelf" and "Your contacts" (phone contacts that aren't app users),
 * filtered by `query` (name, or 3+ digits of the number).
 */
export function buildBorrowerOptions(
  linked: readonly { ownerId: string; ownerPhone: string; displayName: string }[],
  deviceContacts: readonly { name: string; phone: string }[],
  query: string
): BorrowerOptions {
  const q = normaliseText(query);
  const qDigits = query.replace(/\D/g, '');
  const onAppPhones = new Set(linked.map((l) => l.ownerPhone));

  const onApp: Borrower[] = linked.map((l) => ({
    name: l.displayName,
    phone: l.ownerPhone,
    uid: l.ownerId,
  }));
  const contacts: Borrower[] = deviceContacts
    .filter((c) => !onAppPhones.has(c.phone))
    .map((c) => ({ name: c.name, phone: c.phone, uid: null }));

  if (!q && !qDigits) return { onApp, contacts };
  return {
    onApp: onApp.filter((b) => matches(b, q, qDigits)),
    contacts: contacts.filter((b) => matches(b, q, qDigits)),
  };
}

/**
 * Owner → borrower, sent from the success screen after recording a loan. `borrowerName` is the
 * borrower's *profile* name when they're on LendShelf, else null ("Hi!"): never the name typed in
 * or saved in my contacts (R21).
 */
export function lentMessage(input: {
  borrowerName: string | null | undefined;
  title: string;
  dueDate: Date | null;
  now?: Date;
}): string {
  const hi = greeting(input.borrowerName);
  const book = `“${input.title.trim()}”`;
  if (!input.dueDate) return `${hi} Here's ${book}, enjoy! I've noted it on LendShelf.`;
  const when = formatShortDate(input.dueDate, input.now ?? new Date());
  return `${hi} Here's ${book}, enjoy! Could you get it back to me by ${when}? I've noted it on LendShelf.`;
}
