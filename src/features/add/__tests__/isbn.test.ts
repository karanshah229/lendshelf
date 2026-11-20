import {
  cleanIsbn,
  formatIsbn,
  isbn10to13,
  isValidIsbn10,
  isValidIsbn13,
  looksLikeIsbn,
  normaliseIsbn,
  readBarcode,
} from '@/features/add/isbn';

describe('ISBN validation', () => {
  it('validates ISBN-13 check digits in the 978/979 range', () => {
    expect(isValidIsbn13('9780141439518')).toBe(true);
    expect(isValidIsbn13('9780141439519')).toBe(false);
    expect(isValidIsbn13('9791032305690')).toBe(true);
    // Valid EAN-13 but not a book.
    expect(isValidIsbn13('4006381333931')).toBe(false);
  });

  it('validates ISBN-10 including an X check digit', () => {
    expect(isValidIsbn10('0141439513')).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
    expect(isValidIsbn10('0141439514')).toBe(false);
  });

  it('converts ISBN-10 to ISBN-13', () => {
    expect(isbn10to13('0141439513')).toBe('9780141439518');
    expect(isbn10to13('080442957X')).toBe('9780804429573');
  });

  it('normalises typed ISBNs with hyphens and spaces', () => {
    expect(cleanIsbn(' 978-0-14-143951-8 ')).toBe('9780141439518');
    expect(normaliseIsbn('978-0-14-143951-8')).toBe('9780141439518');
    expect(normaliseIsbn('0-8044-2957-x')).toBe('9780804429573');
    expect(normaliseIsbn('12345')).toBeNull();
    expect(normaliseIsbn('')).toBeNull();
    expect(normaliseIsbn(null)).toBeNull();
  });
});

describe('readBarcode', () => {
  it('accepts book EAN-13 barcodes', () => {
    expect(readBarcode('9780141439518')).toEqual({ kind: 'isbn', isbn: '9780141439518' });
  });

  it('rejects other barcodes', () => {
    expect(readBarcode('4006381333931')).toEqual({ kind: 'notIsbn' });
    expect(readBarcode('96385074')).toEqual({ kind: 'notIsbn' });
    expect(readBarcode(undefined)).toEqual({ kind: 'notIsbn' });
  });
});

describe('looksLikeIsbn / formatIsbn', () => {
  it('detects ISBN-shaped search input', () => {
    expect(looksLikeIsbn('978-0141439518')).toBe(true);
    expect(looksLikeIsbn('0141439513')).toBe(true);
    expect(looksLikeIsbn('pride and prejudice')).toBe(false);
    expect(looksLikeIsbn('1984')).toBe(false);
  });

  it('groups ISBN-13 for display', () => {
    expect(formatIsbn('9780141439518')).toBe('978 0141 439518');
    expect(formatIsbn('123')).toBe('123');
  });
});
