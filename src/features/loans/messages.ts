/** WhatsApp messages used only by the Loans tab (others live in `@/lib/whatsapp`). */
import { Linking } from 'react-native';

import { toast } from '@/lib/toast';
import { waLink } from '@/lib/whatsapp';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();
const quoted = (title: string) => `“${title.trim()}”`;

/** Owner → borrower about an incoming request (before deciding, e.g. to agree a pickup). */
export function requestReplyMessage(borrowerName: string, title: string): string {
  return `Hi ${firstName(borrowerName)}! Saw your request for ${quoted(title)} on LendShelf.`;
}

/** Borrower → owner, following up on a pending request. */
export function requestFollowUpMessage(ownerName: string, title: string): string {
  return `Hi ${firstName(ownerName)}! I've asked to borrow ${quoted(title)} on LendShelf. Would that work?`;
}

/** Opens WhatsApp; shows a toast when it can't be opened. */
export async function openWhatsApp(phoneE164: string, text: string): Promise<void> {
  try {
    await Linking.openURL(waLink(phoneE164, text));
  } catch {
    toast.error('Couldn’t open WhatsApp.');
  }
}
