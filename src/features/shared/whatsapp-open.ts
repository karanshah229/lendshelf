import { Linking } from 'react-native';

import { toast } from '@/lib/toast';
import { waLink } from '@/lib/whatsapp';

/** Opens a WhatsApp chat with a prefilled message. Shows a toast if WhatsApp can't be opened. */
export async function openWhatsApp(phoneE164: string, text?: string): Promise<boolean> {
  try {
    await Linking.openURL(waLink(phoneE164, text));
    return true;
  } catch {
    toast.error('Couldn’t open WhatsApp.');
    return false;
  }
}
