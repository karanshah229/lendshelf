import { errorMessage, isNetworkError } from '@/lib/errors';

/** What the web Functions SDK throws: code + message with the HTTP status appended. */
const fnError = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('errorMessage (QA B3: never codes or "[400]")', () => {
  it('drops the web SDK status suffix and rewrites loan-state errors in words', () => {
    expect(
      errorMessage(
        fnError(
          'functions/failed-precondition',
          'Can’t decline this request: this loan is already cancelled. [400]'.replace('’', "'")
        )
      )
    ).toBe('This request was cancelled.');
    expect(
      errorMessage(fnError('functions/failed-precondition', 'This request expired (requests last 7 days). [400]'))
    ).toBe('This request expired (requests last 7 days).');
    expect(errorMessage(fnError('functions/not-found', 'Loan not found. [404]'))).toBe(
      'Loan not found.'
    );
  });

  it('maps codes without a user message to plain words', () => {
    expect(errorMessage(fnError('functions/permission-denied', 'permission-denied [403]'))).toBe(
      'You can’t do that any more.'
    );
    expect(
      errorMessage(fnError('functions/failed-precondition', 'Backend error status: FAILED_PRECONDITION [400]'))
    ).toBe('This has changed since you opened it.');
    expect(errorMessage(fnError('functions/already-exists', 'already-exists [409]'))).toBe(
      'That’s already done.'
    );
    for (const m of [
      errorMessage(fnError('functions/not-found', 'not-found [404]')),
      errorMessage(fnError('functions/internal', 'internal [500]')),
    ]) {
      expect(m).not.toMatch(/\[\d+\]|not-found|internal/);
    }
  });

  it('a failed fetch (status 0) is a connection problem, not "our side"', () => {
    const e = fnError('functions/internal', 'internal [0]');
    expect(isNetworkError(e)).toBe(true);
    expect(errorMessage(e)).toBe('Can’t reach LendShelf. Check your connection and try again.');
    expect(isNetworkError(fnError('functions/internal', 'internal [500]'))).toBe(false);
    expect(isNetworkError(fnError('functions/failed-precondition', 'x [400]'))).toBe(false);
  });
});
