/**
 * Opens the system share sheet with the invite text (WhatsApp is usually first). The web build
 * resolves `share-invite.web.ts`, which opens WhatsApp instead.
 */
import { Share } from 'react-native';

import { toast } from '@/lib/toast';

/**
 * Shares `text`. Resolves to true when the sheet reported a share. The app can't know whether
 * the message was actually sent, so the toast says "shared", never "sent" (E2).
 */
export async function shareInviteText(text: string): Promise<boolean> {
  try {
    const res = await Share.share({ message: text });
    if (res.action === Share.dismissedAction) return false;
    toast('Invite shared');
    return true;
  } catch {
    toast.error('Couldn’t open the share sheet.');
    return false;
  }
}
