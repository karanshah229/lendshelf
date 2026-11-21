/**
 * Pending requests when a copy stops being lendable or visible (UX §E9, R11, C12). Pure, so the
 * rules and the sheet wording are tested without Firebase.
 *
 * - Hidden, moved into a private collection, or its collection made private: the copy disappears
 *   for requesters, so their requests are declined (`notLending`) first, after a confirm sheet
 *   that names them. No Keep option (R11).
 * - Not lending: the copy stays visible and can still be lent, so the owner chooses Decline
 *   (the default) or Keep.
 */
import type { Loan, Visibility, WithId } from '@/types/model';

import { joinNames, shortName, shortNames } from '@/features/shared/people';

type L = WithId<Loan>;

export interface Sharing {
  visibility: Visibility;
  /** Whether people who have my number saved can see the copy (`sharedWithContacts`). */
  shared: boolean;
}

/** What a sharing change means for the copy's pending requests. */
export type PendingEffect = 'none' | 'decline' | 'ask';

export function pendingRequestsEffect(
  from: Sharing,
  to: Sharing,
  requestCount: number
): PendingEffect {
  if (requestCount <= 0) return 'none';
  if (from.shared && !to.shared) return 'decline';
  if (to.shared && from.visibility === 'lendable' && to.visibility === 'visible') return 'ask';
  return 'none';
}

/** Open requests on any of `itemIds`, oldest first (the order the sheet names people in). */
export function requestsOnItems(requests: readonly L[], itemIds: Iterable<string>): L[] {
  const ids = new Set(itemIds);
  return requests
    .filter((l) => l.status === 'requested' && ids.has(l.itemId))
    .sort((a, b) => (a.requestedAt?.toMillis() ?? 0) - (b.requestedAt?.toMillis() ?? 0));
}

/**
 * The people to decline, one entry per request, with the name I see them by (`nameOf`).
 * Used for the sheet text and then for the `respondToRequest` calls.
 */
export function requestersToDecline(
  requests: readonly L[],
  nameOf: (l: L) => string
): { loanId: string; name: string; title: string }[] {
  return requests.map((l) => ({ loanId: l.id, name: nameOf(l), title: l.title }));
}

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const first = shortName;
// One entry per request (one per person); equal names are told apart, never merged.
const people = (names: readonly string[]) => joinNames(shortNames(names), 20);
const quoted = (title: string) => `“${title.trim()}”`;
/** "Ravi’s request" for one person, "requests from Ravi and Kabir" for several. */
const whose = (names: readonly string[]) =>
  names.length === 1 ? `${first(names[0])}’s request` : `requests from ${people(names)}`;

export interface SheetCopy {
  title: string;
  description: string;
  confirm: string;
  /** Only the Not lending sheet has a Keep choice. */
  keep?: string;
}

/** Hiding a copy with pending requests. */
export function hideSheet(title: string, names: readonly string[]): SheetCopy {
  return {
    title: `Hide ${quoted(title)}?`,
    description: `Hiding ${quoted(title)} declines ${whose(names)}. They’ll be told you’re not lending it.`,
    confirm: 'Hide and decline',
  };
}

/** Moving a copy into a private collection with pending requests. */
export function moveToPrivateSheet(
  title: string,
  collection: string,
  names: readonly string[]
): SheetCopy {
  return {
    title: `Move ${quoted(title)} to ${collection}?`,
    description: `${collection} is a private collection. Moving ${quoted(title)} there declines ${whose(names)}. They’ll be told you’re not lending it.`,
    confirm: 'Move and decline',
  };
}

/**
 * Making a collection private when some of its copies have pending requests:
 * "12 books will be hidden … Requests from Ravi (Animal Farm) and Kabir (Dune) will be declined."
 */
export function makePrivateSheet(
  collection: string,
  bookCount: number,
  requests: readonly { name: string; title: string }[]
): SheetCopy {
  const books = `${bookCount} ${bookCount === 1 ? 'book' : 'books'}`;
  const short = shortNames(requests.map((r) => r.name));
  const list = joinNames(
    requests.map((r, i) => `${short[i]} (${r.title})`),
    20
  );
  return {
    title: `Make ${collection} private?`,
    description: `${books} will be hidden from people who have your number saved. ${
      requests.length === 1 ? 'The request from' : 'Requests from'
    } ${list} will be declined.`,
    confirm: 'Make private and decline',
  };
}

/** Setting a copy to Not lending with pending requests: Decline (default) or Keep. */
export function notLendingSheet(names: readonly string[]): SheetCopy {
  const many = names.length > 1;
  return {
    title: `${people(names)} asked for this. Decline ${many ? 'their requests' : 'their request'} too?`,
    description:
      'It will be Not lending either way. A request you keep can still be accepted later.',
    confirm: many ? 'Decline requests' : 'Decline request',
    keep: many ? 'Keep requests' : 'Keep request',
  };
}
