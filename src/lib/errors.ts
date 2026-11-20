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
  'permission-denied': 'You don’t have access to that.',
  unauthenticated: 'Please sign in again.',
  internal: 'Something went wrong on our side. Please try again.',
};

/** Codes whose message is technical rather than written for users. */
const TECHNICAL = new Set(['internal', 'unavailable', 'deadline-exceeded', 'unknown']);

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

  // Strip React Native Firebase's "[functions/not-found] " prefix.
  const message = (e instanceof Error ? e.message : typeof e === 'string' ? e : '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim();
  const isCallableError = !!raw && (raw.startsWith('functions/') || !raw.includes('/'));
  if (isCallableError && code && !TECHNICAL.has(code) && message) return message;

  if (code && GENERIC[code]) return GENERIC[code];
  return fallback;
}
