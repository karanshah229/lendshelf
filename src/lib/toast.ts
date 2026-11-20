/**
 * Toasts (sonner-native). The `<Toaster />` is mounted once in the root layout.
 *
 *   import { toast, toastError } from '@/lib/toast';
 *   toast.success('Request sent');
 *   try { ... } catch (e) { toastError(e) }
 */
import { toast } from 'sonner-native';

import { errorMessage } from '@/lib/errors';

export { toast };

/** Shows a user-friendly error toast for any thrown value. */
export function toastError(e: unknown, fallback?: string) {
  toast.error(errorMessage(e, fallback));
}
