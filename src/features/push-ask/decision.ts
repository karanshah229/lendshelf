/**
 * Notification permission in context (UX §E1, §E12, C11), pure. Never on app start: the first
 * time the user does something with a future event (sends a request, accepts one, records a
 * loan, adds to the wishlist), a one-line pre-prompt says why, then the system dialog.
 * Asked once per user on this device.
 */
import type { PushPermission } from '@/lib/push';
import { shortName } from '@/features/shared/people';

export type PushAskReason = 'request' | 'accept' | 'lend' | 'wishlist';

/**
 * - `prePrompt`: show the one-line reason, then the system dialog if they say yes.
 * - `legacyNote`: Android 12 and below has no runtime prompt (notifications are on by default):
 *   say once what will be sent.
 * - `none`: nothing to ask (already asked, already on, blocked, or no push on this platform).
 */
export type PushAskDecision = 'none' | 'prePrompt' | 'legacyNote';

/** Android 13 (API 33) added the runtime notification permission. */
export const ANDROID_RUNTIME_PROMPT_API = 33;

export function isLegacyAndroid(os: string, version: string | number): boolean {
  return os === 'android' && Number(version) < ANDROID_RUNTIME_PROMPT_API;
}

export function pushAskDecision(input: {
  /** False on web (no push). */
  supported: boolean;
  /** Already asked this user on this device. */
  asked: boolean;
  permission: PushPermission;
  /** The OS can still show its dialog (false once the user blocked it). */
  canAskAgain: boolean;
  legacyAndroid: boolean;
}): PushAskDecision {
  if (!input.supported || input.asked || input.permission === 'unsupported') return 'none';
  if (input.legacyAndroid) return input.permission === 'granted' ? 'legacyNote' : 'none';
  if (input.permission !== 'undetermined' || !input.canAskAgain) return 'none';
  return 'prePrompt';
}

export interface PushAskCopy {
  title: string;
  /** The one-line reason. */
  body: string;
  confirm: string;
  cancel: string | null;
}

const first = (name: string | null | undefined) => shortName(name) || null;

/** The pre-prompt, or the one-time Android ≤ 12 line, for what the user just did. */
export function pushAskCopy(
  decision: Exclude<PushAskDecision, 'none'>,
  reason: PushAskReason,
  ctx: { name?: string | null; title?: string | null } = {}
): PushAskCopy {
  const who = first(ctx.name);
  const book = ctx.title?.trim() ? `“${ctx.title.trim()}”` : 'the book';
  if (decision === 'legacyNote') {
    return {
      title: 'LendShelf will send you notifications',
      body:
        reason === 'request'
          ? `You’ll get a notification when ${who ?? 'the owner'} answers, and before books are due back. You can turn them off in Settings.`
          : reason === 'wishlist'
            ? 'You’ll get a notification when a friend adds a book on your wishlist, and about requests and due dates. You can turn them off in Settings.'
            : `You’ll get a notification before ${book} is due back, and about requests and returns. You can turn them off in Settings.`,
      confirm: 'OK',
      cancel: null,
    };
  }
  if (reason === 'request') {
    return {
      title: `Get told when ${who ?? 'they'} answer${who ? 's' : ''}?`,
      body: `LendShelf sends a notification when ${who ?? 'the owner'} accepts or declines your request.`,
      confirm: 'Turn on notifications',
      cancel: 'Not now',
    };
  }
  if (reason === 'wishlist') {
    return {
      title: 'Get told when a friend has it?',
      body: 'LendShelf sends a notification when someone you know adds a book on your wishlist.',
      confirm: 'Turn on notifications',
      cancel: 'Not now',
    };
  }
  return {
    title: 'Get reminded when it’s due?',
    body: `LendShelf sends a reminder before ${book} is due back, and tells you when it’s returned.`,
    confirm: 'Turn on notifications',
    cancel: 'Not now',
  };
}
