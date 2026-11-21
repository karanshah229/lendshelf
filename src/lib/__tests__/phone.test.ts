import {
  dialCode,
  formatPhone,
  isE164,
  normalisePhone,
  normalisePhoneLenient,
  normalisePhones,
  phoneDigits,
  toCountryCode,
} from '@/lib/phone';

describe('normalisePhone', () => {
  it.each([
    ['+91 98765 43210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    ['(+91) 98765-43210', '+919876543210'],
    ['0091 98765 43210', '+919876543210'],
    ['  +919876543210  ', '+919876543210'],
    ['9000000001', '+919000000001'],
  ])('reads %s in IN as %s', (input, expected) => {
    expect(normalisePhone(input, 'IN')).toBe(expected);
  });

  it('uses the given region for national numbers', () => {
    expect(normalisePhone('020 7946 0958', 'GB')).toBe('+442079460958');
    expect(normalisePhone('(415) 555-2671', 'US')).toBe('+14155552671');
  });

  it('keeps an explicit country code regardless of region', () => {
    expect(normalisePhone('+44 20 7946 0958', 'IN')).toBe('+442079460958');
  });

  it('defaults to IN', () => {
    expect(normalisePhone('98765 43210')).toBe('+919876543210');
  });

  it.each(['', '   ', 'abc', '123', '+91 12345', '++'])('rejects %p', (input) => {
    expect(normalisePhone(input, 'IN')).toBeNull();
  });
});

describe('normalisePhoneLenient', () => {
  it('uses the given region first', () => {
    expect(normalisePhoneLenient('(415) 555-2671', 'US')).toBe('+14155552671');
  });

  it('falls back to IN when the number is not valid in the device region', () => {
    expect(normalisePhone('98123 11111', 'US')).toBeNull();
    expect(normalisePhoneLenient('98123 11111', 'US')).toBe('+919812311111');
  });

  it('still rejects numbers that are invalid everywhere', () => {
    expect(normalisePhoneLenient('123', 'US')).toBeNull();
    expect(normalisePhoneLenient('+91 12345', 'IN')).toBeNull();
  });
});

describe('normalisePhones', () => {
  it('drops invalid numbers and duplicates, keeping order', () => {
    expect(normalisePhones(['98765 43210', 'nope', '+919876543210', '9000000001'], 'IN')).toEqual([
      '+919876543210',
      '+919000000001',
    ]);
  });
});

describe('helpers', () => {
  it('isE164', () => {
    expect(isE164('+919876543210')).toBe(true);
    expect(isE164('919876543210')).toBe(false);
    expect(isE164('+0123456789')).toBe(false);
  });

  it('formatPhone', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('not a phone')).toBe('not a phone');
  });

  it('phoneDigits', () => {
    expect(phoneDigits('+91 98765-43210')).toBe('919876543210');
  });

  it('dialCode', () => {
    expect(dialCode('IN')).toBe('+91');
    expect(dialCode('US')).toBe('+1');
  });

  it('toCountryCode falls back to IN', () => {
    expect(toCountryCode('gb')).toBe('GB');
    expect(toCountryCode(null)).toBe('IN');
    expect(toCountryCode('ZZ')).toBe('IN');
  });
});
