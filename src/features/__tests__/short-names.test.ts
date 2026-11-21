import { joinNames, setCircleNamesSource, shortName, shortNames } from '@/features/shared/people';
import { acceptDeclinesWarning, lendDeclinesWarning } from '@/features/loans/requests';
import { hideSheet } from '@/features/shelves/pending-requests';
import { greeting } from '@/lib/whatsapp';

describe('short names never collide (QA Android #4)', () => {
  afterEach(() => setCircleNamesSource(() => []));

  it('falls back to the full saved name when two people share a first word', () => {
    const among = ['LendShelf Test Ravi', 'LendShelf Test Meera'];
    expect(shortName('LendShelf Test Ravi', among)).toBe('LendShelf Test Ravi');
    expect(shortName('LendShelf Test Meera', among)).toBe('LendShelf Test Meera');
    expect(shortNames(among)).toEqual(among);
  });

  it('keeps the short form when nobody else shares it', () => {
    expect(shortNames(['Ravi Menon', 'Meera Iyer'])).toEqual(['Ravi', 'Meera']);
    expect(shortName('Ravi Menon', ['Ravi Menon', 'Meera Iyer'])).toBe('Ravi');
  });

  it('tells "Ravi" and "Ravi Menon" apart', () => {
    expect(shortNames(['Ravi', 'Ravi Menon'])).toEqual(['Ravi', 'Ravi Menon']);
  });

  it('checks against the whole circle, not just the names on screen', () => {
    setCircleNamesSource(() => ['LendShelf Test Ravi', 'LendShelf Test Meera', 'Asha Rao']);
    expect(shortName('LendShelf Test Ravi')).toBe('LendShelf Test Ravi');
    expect(shortName('Asha Rao')).toBe('Asha');
    expect(`Message ${shortName('LendShelf Test Meera')}`).toBe('Message LendShelf Test Meera');
  });

  it('keeps the earlier rules: titles stay whole, numbers are never cut, notes dropped', () => {
    expect(shortName('Dr. Mehta', ['Dr. Mehta', 'Dr. Rao'])).toBe('Dr. Mehta');
    expect(shortName('+91 90000 00002', ['+91 90000 00002', '+91 90000 00003'])).toBe(
      '+91 90000 00002'
    );
    expect(shortName('Nikhil (neighbour)', ['Nikhil (neighbour)'])).toBe('Nikhil');
    expect(shortNames(['Nikhil (neighbour)', 'Nikhil Rao'])).toEqual([
      'Nikhil (neighbour)',
      'Nikhil Rao',
    ]);
  });

  it('never merges two people because their names match', () => {
    expect(joinNames(['Ravi', 'Ravi'])).toBe('Ravi and Ravi');
    expect(joinNames(shortNames(['LendShelf Test Ravi', 'LendShelf Test Meera']))).toBe(
      'LendShelf Test Ravi and LendShelf Test Meera'
    );
    expect(lendDeclinesWarning(['LendShelf Test Ravi', 'LendShelf Test Meera'])).toBe(
      'LendShelf Test Ravi and LendShelf Test Meera asked for this. Their requests will be declined.'
    );
    expect(acceptDeclinesWarning(['Kabir Shah', 'Kabir Das'])).toMatch(
      /^Requests from Kabir Shah and Kabir Das will be declined\./
    );
    expect(hideSheet('Dune', ['Ravi', 'Ravi']).description).toMatch(/declines requests from Ravi and Ravi\./);
  });

  it('WhatsApp greetings use the profile first name, not widened by the circle', () => {
    setCircleNamesSource(() => ['Ravi Menon', 'Ravi Kumar']);
    expect(greeting('Ravi Menon')).toBe('Hi Ravi!');
    expect(greeting('Dr. Mehta')).toBe('Hi Dr. Mehta!');
    expect(greeting(null)).toBe('Hi!');
  });
});
