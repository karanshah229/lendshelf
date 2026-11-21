import {
  addBooksLabel,
  CONTACTS_OFF_COPY,
  contactsResultCopy,
  firstRunCase,
  libraryWelcomeLine,
  loansEmptyCopy,
  meContactsDetail,
  setupBooksLine,
  setupCopy,
  syncErrorText,
} from '@/features/first-run/first-run';

describe('the three new-user cases (E2a)', () => {
  it('picks (ii) whenever someone is in the circle', () => {
    expect(firstRunCase({ hasAddressBook: true, permission: 'granted', peopleCount: 2 })).toBe(
      'circle'
    );
    // Links made on another phone still count, whatever this phone's permission.
    expect(firstRunCase({ hasAddressBook: true, permission: 'denied', peopleCount: 1 })).toBe(
      'circle'
    );
  });

  it('picks (iii) with contacts off on a phone, (i) otherwise', () => {
    expect(firstRunCase({ hasAddressBook: true, permission: 'denied', peopleCount: 0 })).toBe(
      'contactsOff'
    );
    expect(firstRunCase({ hasAddressBook: true, permission: 'undetermined', peopleCount: 0 })).toBe(
      'contactsOff'
    );
    expect(firstRunCase({ hasAddressBook: true, permission: 'granted', peopleCount: 0 })).toBe(
      'empty'
    );
    expect(firstRunCase({ hasAddressBook: true, permission: 'limited', peopleCount: 0 })).toBe(
      'empty'
    );
    // Web has no address book and no permission.
    expect(firstRunCase({ hasAddressBook: false, permission: 'denied', peopleCount: 0 })).toBe(
      'empty'
    );
  });
});

describe('Find your people result', () => {
  it('(i) 0 matches: invite is the primary, Continue secondary', () => {
    const c = contactsResultCopy({ names: [], bookCount: 0 });
    expect(c.title).toBe('None of your contacts are on LendShelf yet');
    expect(c.body).toBe(
      'You’ll see books from people whose numbers you’ve saved. Invite the friends you swap books with. It works best with three or more.'
    );
    expect(c.primary).toEqual({ action: 'invite', label: 'Invite friends on WhatsApp' });
    expect(c.secondary).toEqual({ action: 'continue', label: 'Continue' });
    expect(c.names).toBeNull();
  });

  it('(ii) 2 matches with 40 books: Continue, with "Invite more friends"', () => {
    const c = contactsResultCopy({ names: ['Asha Rao', 'Ravi Menon'], bookCount: 40 });
    expect(c.title).toBe('Found 2 people you know');
    expect(c.names).toBe('Asha Rao · Ravi Menon');
    expect(c.body).toBe('You’ll see the books they share: 40 so far.');
    expect(c.primary).toEqual({ action: 'continue', label: 'Continue' });
    expect(c.secondary).toEqual({ action: 'invite', label: 'Invite more friends' });
  });

  it('one person, books still loading, and no invite offer from 3 people', () => {
    expect(contactsResultCopy({ names: ['Asha'], bookCount: null })).toMatchObject({
      title: 'Found 1 person you know',
      body: 'You’ll see the books they share.',
    });
    const many = contactsResultCopy({ names: ['A', 'B', 'C', 'D', 'E'], bookCount: 3 });
    expect(many.names).toBe('A · B · C and 2 more');
    expect(many.secondary).toBeNull();
  });

  it('(iii) contacts off copy, and sync errors in words', () => {
    expect(CONTACTS_OFF_COPY.title).toBe('Contacts are off');
    expect(CONTACTS_OFF_COPY.primary).toBe('Open Settings');
    expect(CONTACTS_OFF_COPY.secondary).toBe('Continue without');
    expect(syncErrorText('resource-exhausted')).toBe(
      'You’ve synced a lot today. Try again tomorrow.'
    );
    expect(syncErrorText('unavailable')).toBe('Couldn’t check your contacts.');
  });
});

describe('Home setup card copy', () => {
  it('(i) empty circle: invite, or Try again after a failed sync', () => {
    const c = setupCopy({ case: 'empty', permission: 'granted', syncFailed: false });
    expect(c.title).toBe('Your circle is empty for now');
    expect(c.body).toMatch(/^When people in your contacts join LendShelf/);
    expect(c.peopleAction).toBe('invite');
    expect(c.peopleActionLabel).toBe('Invite friends');
    expect(setupCopy({ case: 'empty', permission: 'granted', syncFailed: true })).toMatchObject({
      peopleAction: 'retry',
      peopleActionLabel: 'Try again',
    });
  });

  it('(iii) contacts off: Turn on contacts (Settings once denied, the prompt if never asked)', () => {
    const denied = setupCopy({ case: 'contactsOff', permission: 'denied', syncFailed: false });
    expect(denied.title).toBe('Turn on contacts to see your friends’ books');
    expect(denied.body).toBe(
      'Only numbers are checked, to find friends on LendShelf. Nothing from your address book is stored.'
    );
    expect(denied).toMatchObject({
      peopleAction: 'openSettings',
      peopleActionLabel: 'Turn on contacts',
    });
    expect(
      setupCopy({ case: 'contactsOff', permission: 'undetermined', syncFailed: false }).peopleAction
    ).toBe('askContacts');
  });

  it('(ii) uses "Get set up · n of 3" and Scan your shelf', () => {
    expect(
      setupCopy({ case: 'circle', permission: 'granted', syncFailed: false }).title
    ).toBeNull();
    expect(addBooksLabel(true)).toBe('Scan your shelf');
    expect(addBooksLabel(false)).toBe('Search for a book');
  });
});

describe('My books welcome line', () => {
  it('reassures before friends join; names them after', () => {
    expect(libraryWelcomeLine([])).toBe(
      'Even before friends join, you can lend books to anyone and LendShelf remembers who has them.'
    );
    expect(libraryWelcomeLine(['Asha Rao', 'Ravi Menon'])).toBe(
      'Asha and Ravi will see what you add if they have your number saved. You choose what they can borrow.'
    );
    expect(libraryWelcomeLine(['Asha Rao', 'Ravi Menon', 'Meera Iyer'])).toBe(
      'Asha and 2 others will see what you add if they have your number saved. You choose what they can borrow.'
    );
  });
});

describe('setup card line under Add your books', () => {
  // One-way matching: I only know whom I saved, not who saved me (QA-ANDROID bug 8).
  it('never promises a named person can borrow', () => {
    expect(setupBooksLine('Asha')).toBe(
      'Once you add yours, Asha can ask to borrow them if they have your number saved.'
    );
    expect(setupBooksLine('Asha')).not.toMatch(/can borrow from you/);
  });

  it('is hidden with nobody in the circle', () => {
    expect(setupBooksLine('')).toBeNull();
  });
});

describe('Loans empty state', () => {
  it('one primary per situation', () => {
    expect(loansEmptyCopy({ hasPeople: false, hasBooks: false })).toEqual({
      title: 'No loans yet',
      body: 'Add your books first, then record who borrows them. They don’t need the app.',
      primary: { action: 'addBooks', label: 'Add your books' },
    });
    expect(loansEmptyCopy({ hasPeople: false, hasBooks: true })).toEqual({
      title: 'No loans yet',
      body: 'Lent a book to someone? Record it here so you remember who has it. They don’t need the app.',
      primary: { action: 'lend', label: 'Lend a book' },
    });
    expect(loansEmptyCopy({ hasPeople: true, hasBooks: false })).toEqual({
      title: 'No loans yet',
      body: 'Ask to borrow a book from Home and it shows up here, with its due date.',
      primary: { action: 'findBook', label: 'Find a book' },
    });
  });
});

describe('Me › Contacts row', () => {
  const base = {
    hasAddressBook: true,
    permission: 'granted' as const,
    linkCount: 0,
    checkedAgo: 'just now',
    skippedRemovals: 0,
    manualCount: 0,
  };

  it('reads like E2a', () => {
    expect(meContactsDetail(base)).toBe('0 people on LendShelf · checked just now');
    expect(meContactsDetail({ ...base, linkCount: 2 })).toBe(
      '2 people on LendShelf · checked just now'
    );
    expect(meContactsDetail({ ...base, permission: 'denied' })).toBe('Off · Turn on');
  });

  it('flags a guarded automatic sync, and shows the web list', () => {
    expect(meContactsDetail({ ...base, linkCount: 10, skippedRemovals: 7 })).toBe(
      'Some contacts weren’t checked · Sync now'
    );
    expect(meContactsDetail({ ...base, hasAddressBook: false, manualCount: 5, linkCount: 1 })).toBe(
      '5 added by hand · 1 person on LendShelf · checked just now'
    );
    expect(meContactsDetail({ ...base, checkedAgo: null })).toBe('not checked yet');
  });
});
