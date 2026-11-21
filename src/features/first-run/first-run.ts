/**
 * The brand-new user, screen by screen (UX §E2a), pure: which of the three cases applies and
 * the exact copy and single primary action each screen shows for it.
 *
 *   (i)   contacts granted, nobody found   → 'empty'
 *   (ii)  contacts granted, people found   → 'circle'
 *   (iii) contacts off                     → 'contactsOff' (native only; web has no address book)
 */
import type { ContactsPermission } from '@/lib/contacts';
import { joinNames, shortName } from '@/features/shared/people';

export type FirstRunCase = 'empty' | 'circle' | 'contactsOff';

export function firstRunCase(input: {
  /** False on web, where contacts are a hand-made list that needs no permission. */
  hasAddressBook: boolean;
  /** Null while it's being checked. */
  permission: ContactsPermission | null;
  /** People in my circle (links). */
  peopleCount: number;
}): FirstRunCase {
  if (input.peopleCount > 0) return 'circle';
  if (
    input.hasAddressBook &&
    (input.permission === 'denied' || input.permission === 'undetermined')
  ) {
    return 'contactsOff';
  }
  return 'empty';
}

/** Short names for copy: "Asha Rao" → "Asha", "Dr. Mehta" stays whole (QA B2). */
export const firstName = (name: string) => shortName(name) || name;

// ---------- Find your people (contacts screen) ----------

export type ContactsAction = 'invite' | 'continue';

export interface ContactsResultCopy {
  title: string;
  /** "Asha Rao · Ravi Menon" (case ii only). */
  names: string | null;
  body: string;
  primary: { action: ContactsAction; label: string };
  secondary: { action: ContactsAction; label: string } | null;
}

/** Invite is offered on the result screen while the circle is this small (E2). */
export const INVITE_OFFER_MAX = 2;
const NAMES_SHOWN = 3;

/** The result on the Find-your-people screen after a sync (E2a i and ii). */
export function contactsResultCopy(input: {
  /** Display names of the people found. */
  names: readonly string[];
  /** Books they share, once known (null while loading). */
  bookCount: number | null;
}): ContactsResultCopy {
  const n = input.names.length;
  if (n === 0) {
    return {
      title: 'None of your contacts are on LendShelf yet',
      names: null,
      body: 'You’ll see books from people whose numbers you’ve saved. Invite the friends you swap books with. It works best with three or more.',
      primary: { action: 'invite', label: 'Invite friends on WhatsApp' },
      secondary: { action: 'continue', label: 'Continue' },
    };
  }
  const shown = input.names.slice(0, NAMES_SHOWN).join(' · ');
  const more = n > NAMES_SHOWN ? ` and ${n - NAMES_SHOWN} more` : '';
  const books =
    input.bookCount && input.bookCount > 0
      ? `You’ll see the books they share: ${input.bookCount} so far.`
      : 'You’ll see the books they share.';
  return {
    title: `Found ${n} ${n === 1 ? 'person' : 'people'} you know`,
    names: shown + more,
    body: books,
    primary: { action: 'continue', label: 'Continue' },
    secondary: n <= INVITE_OFFER_MAX ? { action: 'invite', label: 'Invite more friends' } : null,
  };
}

/** Case (iii) on the Find-your-people screen. */
export const CONTACTS_OFF_COPY = {
  title: 'Contacts are off',
  body: 'LendShelf can only show you books from people whose numbers you’ve saved. It checks numbers only and never stores your address book.',
  primary: 'Open Settings',
  secondary: 'Continue without',
} as const;

/** Sync failures, said in words the user can act on (E1 failure exits). */
export function syncErrorText(code: string | null): string {
  if (code === 'resource-exhausted') return 'You’ve synced a lot today. Try again tomorrow.';
  return 'Couldn’t check your contacts.';
}

// ---------- Home setup card ----------

/** What the setup card's "Find your people" row does while it isn't done. */
export type PeopleAction = 'invite' | 'retry' | 'openSettings' | 'askContacts';

export interface SetupCopy {
  /** Null: use "Get set up · n of 3". */
  title: string | null;
  body: string | null;
  peopleAction: PeopleAction;
  peopleActionLabel: string;
}

/** Home's setup card per case (E2a): title and body, and the people row's action. */
export function setupCopy(input: {
  case: FirstRunCase;
  permission: ContactsPermission | null;
  /** The last sync failed: case (i) copy with "Try again" instead of Invite (E1). */
  syncFailed: boolean;
}): SetupCopy {
  if (input.case === 'contactsOff') {
    return {
      title: 'Turn on contacts to see your friends’ books',
      body: 'Only numbers are checked, to find friends on LendShelf. Nothing from your address book is stored.',
      // Never asked yet: the system prompt can still be shown; once denied, only Settings can.
      peopleAction: input.permission === 'undetermined' ? 'askContacts' : 'openSettings',
      peopleActionLabel: 'Turn on contacts',
    };
  }
  if (input.case === 'empty') {
    return {
      title: 'Your circle is empty for now',
      body: 'When people in your contacts join LendShelf, the books they share show up here. Until then, LendShelf can still keep track of books you lend to anyone.',
      peopleAction: input.syncFailed ? 'retry' : 'invite',
      peopleActionLabel: input.syncFailed ? 'Try again' : 'Invite friends',
    };
  }
  return { title: null, body: null, peopleAction: 'invite', peopleActionLabel: 'Invite friends' };
}

/** The setup card's button for "Add your books": scanning needs a camera (web: search). */
export const addBooksLabel = (canScan: boolean) =>
  canScan ? 'Scan your shelf' : 'Search for a book';

// ---------- My books (welcome) ----------

/** The extra line on My books' welcome screen (E2a). */
export function libraryWelcomeLine(friendNames: readonly string[]): string {
  if (!friendNames.length) {
    return 'Even before friends join, you can lend books to anyone and LendShelf remembers who has them.';
  }
  return `${joinNames(friendNames.map(firstName), 2)} will see what you add. You choose what they can borrow.`;
}

// ---------- Loans (empty) ----------

export type LoansEmptyAction = 'findBook' | 'addBooks' | 'lend';

export interface LoansEmptyCopy {
  title: string;
  body: string;
  primary: { action: LoansEmptyAction; label: string };
}

/** Loans' empty state (E2a): one primary, chosen by whether I have people and books. */
export function loansEmptyCopy(input: { hasPeople: boolean; hasBooks: boolean }): LoansEmptyCopy {
  const title = 'No loans yet';
  if (input.hasPeople) {
    return {
      title,
      body: 'Ask to borrow a book from Home and it shows up here, with its due date.',
      primary: { action: 'findBook', label: 'Find a book' },
    };
  }
  if (!input.hasBooks) {
    return {
      title,
      body: 'Add your books first, then record who borrows them. They don’t need the app.',
      primary: { action: 'addBooks', label: 'Add your books' },
    };
  }
  return {
    title,
    body: 'Lent a book to someone? Record it here so you remember who has it. They don’t need the app.',
    primary: { action: 'lend', label: 'Lend a book' },
  };
}

// ---------- Me ----------

/** The Contacts row detail in Me (E2a, E13). */
export function meContactsDetail(input: {
  hasAddressBook: boolean;
  permission: ContactsPermission | null;
  linkCount: number;
  /** "just now", "2 h ago" (null: never synced on this device). */
  checkedAgo: string | null;
  skippedRemovals: number;
  /** Web only: contacts added by hand. */
  manualCount: number;
}): string {
  if (input.hasAddressBook && input.permission === 'denied') return 'Off · Turn on';
  if (input.skippedRemovals > 0) return 'Some contacts weren’t checked · Sync now';
  const n = input.linkCount;
  const people = `${n} ${n === 1 ? 'person' : 'people'} on LendShelf`;
  const parts = input.hasAddressBook ? [] : [`${input.manualCount} added by hand`];
  if (input.checkedAgo) parts.push(people, `checked ${input.checkedAgo}`);
  else parts.push('not checked yet');
  return parts.join(' · ');
}
