/**
 * The invite message (UX §E2), built on the device: why, where to get the app, and "save my
 * number", because matching is one-way and a friend only sees my shelf once my number is saved.
 */
import { formatPhone } from '@/lib/phone';

/**
 * The download link (open question H1: there's no store listing yet). Set
 * `EXPO_PUBLIC_INVITE_URL` at build time; unset, the text asks for the link instead of
 * pointing somewhere made up. `process.env.EXPO_PUBLIC_*` must be read literally to be inlined.
 */
export const INVITE_URL: string | null = normaliseInviteUrl(process.env.EXPO_PUBLIC_INVITE_URL);

/** The line used while no download link is configured. */
export const INVITE_URL_PLACEHOLDER = 'Ask me for the app link.';

export function normaliseInviteUrl(value: string | null | undefined): string | null {
  const url = value?.trim();
  return url ? url : null;
}

/**
 * "I'm putting my books on LendShelf so friends can borrow instead of buying. Get it here:
 * <link>. Save my number (+91 …) so you can see my shelf."
 */
export function inviteText(input: {
  /** My number, E.164 (null if unknown: the "save my number" line still asks, without it). */
  myPhone: string | null | undefined;
  url?: string | null;
}): string {
  const url = input.url === undefined ? INVITE_URL : normaliseInviteUrl(input.url);
  const get = url ? `Get it here: ${url}` : INVITE_URL_PLACEHOLDER.replace(/\.$/, '');
  const phone = input.myPhone ? ` (${formatPhone(input.myPhone)})` : '';
  return [
    'I’m putting my books on LendShelf so friends can borrow instead of buying.',
    `${get}.`,
    `Save my number${phone} so you can see my shelf.`,
  ].join(' ');
}

/** WhatsApp with the text and no number: the user picks the chat (web, where there's no share sheet). */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
