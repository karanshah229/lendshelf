/** Web has no share sheet: open WhatsApp with the text and no number. Same surface as native. */
import { Linking } from 'react-native';

import { toast } from '@/lib/toast';

import { whatsAppShareUrl } from './invite-text';

export async function shareInviteText(text: string): Promise<boolean> {
  try {
    await Linking.openURL(whatsAppShareUrl(text));
    toast('Invite shared');
    return true;
  } catch {
    toast.error('Couldn’t open WhatsApp.');
    return false;
  }
}
