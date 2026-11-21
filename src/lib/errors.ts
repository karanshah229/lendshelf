/**
 * Turns Firebase / network errors into short, user-facing messages.
 * Callable `HttpsError` messages are written for users by the backend and pass through.
 */

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'That phone number doesn’t look right.',
  'auth/missing-phone-number': 'Enter your phone number.',
  'auth/invalid-verification-code': 'That code isn’t right. Check the SMS and try again.',
  'auth/code-expired': 'That code has expired. Request a new one.',
  'auth/session-expired': 'That code has expired. Request a new one.',
  'auth/too-many-requests': 'Too many attempts. Please wait a bit and try again.',
  'auth/quota-exceeded': 'Too many SMS requests right now. Please try again later.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/captcha-check-failed': 'Verification failed. Please try again.',
};

const GENERIC: Record<string, string> = {
  unavailable: 'Can’t reach the server. Check your connection and try again.',
  'deadline-exceeded': 'That took too long. Please try again.',
  'permission-denied': 'You can’t do that any more.',
  'failed-precondition': 'This has changed since you opened it.',
  'not-found': 'This isn’t there any more.',
  'already-exists': 'That’s already done.',
  unauthenticated: 'Please sign in again.',
  internal: 'Something went wrong on our side. Please try again.',
};

const OFFLINE = 'You’re offline. Check your connection and try again.';
const NO_SERVER = 'Can’t reach LendShelf. Check your connection and try again.';

/** Codes whose message is technical rather than written for users. */
const TECHNICAL = new Set(['internal', 'unavailable', 'deadline-exceeded', 'unknown']);

/**
 * Server messages that name the loan state in a technical way
 * ("Can't decline this request: this loan is already cancelled."), rewritten in words.
 */
const LOAN_STATE_WORDS: [RegExp, string][] = [
  [/this loan is already cancelled/, 'This request was cancelled.'],
  [/this loan is expired/, 'This request expired.'],
  [/this loan is already declined/, 'This request was already declined.'],
  [/this loan is already returned/, 'This book is already back.'],
  [/this loan is an active loan/, 'This book is already lent.'],
  [/this loan is still a request/, 'This is still a request.'],
  [/this loan is waiting for the owner to confirm/, 'This is waiting for the owner to confirm the return.'],
  [/this loan is closed because the owner left/, 'This loan was closed because the owner left LendShelf.'],
];

/** "Backend error status: X [400]" / "… [0]": the web SDK appends the HTTP status. */
function httpStatusOf(message: string): number | null {
  const m = /\[(\d{1,3})\]\s*$/.exec(message);
  return m ? Number(m[1]) : null;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Whether the call never reached the server (no connection, server down). The web
 * Functions SDK reports a failed fetch as `internal` with HTTP status 0.
 */
export function isNetworkError(e: unknown): boolean {
  const code = errorCode(e);
  if (code === 'unavailable' || code === 'auth/network-request-failed') return true;
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  if (code === 'internal' && httpStatusOf(message) === 0) return true;
  if (e instanceof TypeError && /fetch|network/i.test(message)) return true;
  return isOffline() && (code === 'internal' || code === 'unknown' || code === null);
}

function rawCode(e: unknown): string | null {
  if (
    typeof e === 'object' &&
    e &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string'
  ) {
    return (e as { code: string }).code;
  }
  return null;
}

/** Error code without the SDK prefix, e.g. `functions/not-found` → `not-found` (auth codes keep theirs). */
export function errorCode(e: unknown): string | null {
  const code = rawCode(e);
  if (!code) return null;
  return code.startsWith('auth/') ? code : code.replace(/^(functions|firestore|storage)\//, '');
}

export function errorMessage(
  e: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  const raw = rawCode(e);
  const code = errorCode(e);
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (isNetworkError(e)) return isOffline() ? OFFLINE : NO_SERVER;

  // Strip React Native Firebase's "[functions/not-found] " prefix and the web SDK's
  // " [400]" status suffix: users never see codes (QA B3).
  const message = (e instanceof Error ? e.message : typeof e === 'string' ? e : '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s*\[\d{1,3}\]\s*$/, '')
    .trim();
  const isCallableError = !!raw && (raw.startsWith('functions/') || !raw.includes('/'));
  const technical =
    !message || message === code || /^(Backend error status|Unknown backend error)/.test(message);
  if (isCallableError && code && !TECHNICAL.has(code) && !technical) {
    for (const [pattern, words] of LOAN_STATE_WORDS) if (pattern.test(message)) return words;
    return message;
  }

  if (code && GENERIC[code]) return GENERIC[code];
  return fallback;
}
