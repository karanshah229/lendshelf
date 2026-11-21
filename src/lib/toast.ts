/**
 * Toasts (sonner-native). The `<Toaster />` is mounted once in the root layout.
 *
 *   import { toast, toastError } from '@/lib/toast';
 *   toast.success('Request sent');
 *   try { ... } catch (e) { toastError(e) }
 *
 * Toasts only repeat what is already visible inline (UX §F4, §F8). They are read out by screen
 * readers: sonner's live region covers Android and web; on iOS (no live regions) each toast is
 * also announced through VoiceOver.
 */
import { Platform } from 'react-native';
import { toast as sonner } from 'sonner-native';

import { announce, sentences } from '@/lib/a11y';
import { errorMessage, isNetworkError } from '@/lib/errors';

function say(title: unknown, options?: { description?: unknown }) {
  if (Platform.OS !== 'ios' || typeof title !== 'string') return;
  const description = typeof options?.description === 'string' ? options.description : null;
  announce(sentences([title, description]));
}

type Variant = 'success' | 'error' | 'warning' | 'info';

function wrap<K extends Variant>(kind: K): (typeof sonner)[K] {
  const fn = sonner[kind] as (title: string, options?: { description?: unknown }) => unknown;
  return ((title: string, options?: { description?: unknown }) => {
    say(title, options);
    return fn(title, options);
  }) as (typeof sonner)[K];
}

const plain = ((title: string, options?: { description?: unknown }) => {
  say(title, options);
  return (sonner as unknown as (t: string, o?: unknown) => unknown)(title, options);
}) as unknown as typeof sonner;

export const toast: typeof sonner = Object.assign(plain, sonner, {
  success: wrap('success'),
  error: wrap('error'),
  warning: wrap('warning'),
  info: wrap('info'),
});

/**
 * Shows a user-friendly error toast for any thrown value (never a raw code, QA B3). Pass
 * `retry` to offer a Retry button when the call didn't reach the server (F4: toast + Retry
 * for network errors).
 */
export function toastError(e: unknown, fallback?: string, opts: { retry?: () => void } = {}) {
  const message = errorMessage(e, fallback);
  if (opts.retry && isNetworkError(e)) {
    const retry = opts.retry;
    toast.error(message, { action: { label: 'Retry', onClick: () => retry() } });
    return;
  }
  toast.error(message);
}
