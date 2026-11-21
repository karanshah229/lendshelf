import {
  aboutBookMessage,
  askMessage,
  borrowerGreetName,
  greeting,
  nudgeMessage,
  returnMessage,
  waLink,
} from '@/lib/whatsapp';

const NOW = new Date(2026, 10, 21, 10);

describe('waLink', () => {
  it('uses digits only', () => {
    expect(waLink('+91 98765 43210')).toBe('https://wa.me/919876543210');
  });

  it('URL-encodes the prefilled text', () => {
    const url = waLink('+919876543210', 'Hi! Could I borrow “Dune” & more?\nThanks');
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    const text = decodeURIComponent(url.split('?text=')[1]!);
    expect(text).toBe('Hi! Could I borrow “Dune” & more?\nThanks');
    expect(url).not.toMatch(/[\s&]text=.*[ &\n]/);
  });
});

describe('messages', () => {
  it('askMessage uses the first name and appends the note', () => {
    expect(askMessage({ ownerName: 'Asha Rao', title: 'Dune' })).toBe(
      "Hi Asha! Could I borrow “Dune”? I've sent a request on LendShelf."
    );
    expect(askMessage({ ownerName: 'Asha', title: 'Dune', note: '  This weekend?  ' })).toBe(
      "Hi Asha! Could I borrow “Dune”? I've sent a request on LendShelf.\n\nThis weekend?"
    );
  });

  it('nudgeMessage before the due date', () => {
    expect(
      nudgeMessage({
        borrowerName: 'Ravi K',
        title: 'Dune',
        dueDate: new Date(2026, 11, 12),
        now: NOW,
      })
    ).toBe(
      'Hi Ravi! Just a reminder that “Dune” is due back on 12 Dec. No rush, just let me know if you need longer.'
    );
  });

  it('nudgeMessage on the due date and when overdue', () => {
    expect(
      nudgeMessage({
        borrowerName: 'Ravi',
        title: 'Dune',
        dueDate: new Date(2026, 10, 21),
        now: NOW,
      })
    ).toContain('is due back today');
    expect(
      nudgeMessage({
        borrowerName: 'Ravi',
        title: 'Dune',
        dueDate: new Date(2026, 10, 18),
        now: NOW,
      })
    ).toBe(
      'Hi Ravi! Just a reminder that “Dune” was due back on 18 Nov. Could you return it when you get a chance?'
    );
  });

  it('nudgeMessage without a due date', () => {
    expect(
      nudgeMessage({ borrowerName: 'Ravi', title: 'Dune', dueDate: null, now: NOW })
    ).toContain("Hope you're enjoying “Dune”");
  });

  it('returnMessage and aboutBookMessage', () => {
    expect(returnMessage({ ownerName: 'Asha', title: 'Dune' })).toBe(
      "Hi Asha! I've finished “Dune”, thank you! When's a good time to drop it back?"
    );
    expect(aboutBookMessage({ ownerName: 'Asha', title: 'Dune' })).toBe(
      'Hi Asha! I saw “Dune” on your LendShelf.'
    );
  });
});

describe('greeting by profile first name (F6)', () => {
  it('uses the profile first name, never a saved nickname, else "Hi!"', () => {
    // Saved in my contacts as "Dr. Mehta"; his LendShelf profile says "Ravi Mehta".
    expect(askMessage({ ownerName: 'Ravi Mehta', title: 'Dune' })).toMatch(/^Hi Ravi! /);
    expect(greeting('  Ravi  Mehta ')).toBe('Hi Ravi!');
    expect(greeting(null)).toBe('Hi!');
    // A profile name that starts with a title is never cut to it (QA B2, R21).
    expect(greeting('Dr. Mehta')).toBe('Hi Dr. Mehta!');
    expect(greeting('Kabir')).toBe('Hi Kabir!');
    expect(greeting('   ')).toBe('Hi!');
    expect(aboutBookMessage({ ownerName: undefined, title: 'Dune' })).toBe(
      'Hi! I saw “Dune” on your LendShelf.'
    );
    expect(nudgeMessage({ borrowerName: null, title: 'Dune', dueDate: null, now: NOW })).toMatch(
      /^Hi! Hope you're enjoying/
    );
  });

  it('greets a loan borrower by profile name only', () => {
    const requested = { borrowerUid: 'u1', borrowerName: 'Asha Rao', requestedAt: {} };
    const handLent = { borrowerUid: 'u1', borrowerName: 'Dr. Mehta', requestedAt: null };
    const nonApp = { borrowerUid: null, borrowerName: 'Neighbour', requestedAt: null };
    expect(borrowerGreetName(requested)).toBe('Asha Rao');
    expect(borrowerGreetName(handLent)).toBeNull();
    expect(borrowerGreetName(handLent, 'Ravi Mehta')).toBe('Ravi Mehta');
    expect(borrowerGreetName(nonApp, 'Ignored')).toBeNull();
  });
});
