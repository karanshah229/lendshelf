import { day, NOW } from '@/features/loans/__fixtures__/loans';
import {
  acceptedMessage,
  dueChangedMessage,
  leavingMessage,
  moreTimeMessage,
  notBackYetMessage,
  requestReplyMessage,
} from '@/features/loans/messages';
import { pickableCopies } from '@/features/lend/pick-copy';

jest.mock('react-native', () => ({ Linking: { openURL: jest.fn() } }));
jest.mock('@/lib/toast', () => ({ toast: { error: jest.fn() } }));

describe('loan WhatsApp messages (greet by profile first name, R21)', () => {
  it('accept: book, pickup note (left out when empty) and due date', () => {
    expect(
      acceptedMessage({
        borrowerName: 'Zoya Khan',
        title: 'Animal Farm',
        dueDate: day(21),
        pickupNote: 'Koramangala, weekends',
      })
    ).toBe(
      'Hi Zoya! Yes, you can borrow “Animal Farm”! Pickup: Koramangala, weekends. Due back 12 Dec.'
    );
    expect(
      acceptedMessage({
        borrowerName: null,
        title: 'Animal Farm',
        dueDate: day(21),
        pickupNote: ' ',
      })
    ).toBe('Hi! Yes, you can borrow “Animal Farm”! Due back 12 Dec.');
  });

  it('due date changed, not back yet, leaving, request reply', () => {
    expect(
      dueChangedMessage({ borrowerName: 'Zoya', title: 'Animal Farm', dueDate: day(28) })
    ).toBe('Hi Zoya! No problem, keep “Animal Farm” till 19 Dec.');
    // Shortened: a request, not "no problem" (QA friction).
    expect(
      dueChangedMessage({
        borrowerName: 'Zoya',
        title: 'Animal Farm',
        dueDate: day(10),
        previousDue: day(21),
      })
    ).toBe("Hi Zoya! Could I have “Animal Farm” back by 1 Dec? I've changed the due date on LendShelf.");
    expect(notBackYetMessage({ borrowerName: 'Asha Rao', title: 'Sapiens' })).toContain('Hi Asha!');
    expect(leavingMessage({ borrowerName: 'Asha', title: 'Animal Farm' })).toContain(
      '“Animal Farm”'
    );
    expect(requestReplyMessage(null, 'Dune')).toBe('Hi! Saw your request for “Dune” on LendShelf.');
  });

  it('ask for more time proposes due date + 1 week (or today + 1 week when overdue)', () => {
    expect(moreTimeMessage({ ownerName: 'Ravi', title: 'Dune', dueDate: day(5), now: NOW })).toBe(
      'Hi Ravi! Could I keep “Dune” a little longer? Maybe till 3 Dec?'
    );
    expect(
      moreTimeMessage({ ownerName: 'Ravi', title: 'Dune', dueDate: day(-5), now: NOW })
    ).toMatch(/till 28 Nov\?$/);
  });
});

describe('pickableCopies (Lend a book)', () => {
  const item = (
    id: string,
    p: Partial<{
      loanState: 'available' | 'lent';
      visibility: 'lendable' | 'visible' | 'hidden';
      title: string;
    }>
  ) => ({
    id,
    loanState: 'available' as const,
    visibility: 'lendable' as const,
    title: id,
    authors: ['Someone'],
    ...p,
  });

  it('keeps copies on the shelf, lendable first, newest first within a group, and searches', () => {
    const items = [
      item('hidden-new', { visibility: 'hidden' }),
      item('out', { loanState: 'lent' }),
      item('lendable-new', {}),
      item('notlending', { visibility: 'visible' }),
      item('lendable-old', { title: 'Animal Farm' }),
    ];
    expect(pickableCopies(items).map((i) => i.id)).toEqual([
      'lendable-new',
      'lendable-old',
      'notlending',
      'hidden-new',
    ]);
    expect(pickableCopies(items, 'animal').map((i) => i.id)).toEqual(['lendable-old']);
    expect(pickableCopies(items, 'someone')).toHaveLength(4);
  });
});
