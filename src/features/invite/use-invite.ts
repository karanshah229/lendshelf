import { useCallback } from 'react';

import { openWhatsApp } from '@/features/shared/whatsapp-open';
import { useSessionStore } from '@/stores/session';

import { inviteText } from './invite-text';
import { shareInviteText } from './share-invite';

/**
 * `invite()` shares the invite (share sheet; web: WhatsApp with no number).
 * `invite(phone)` opens a WhatsApp chat with that person, e.g. someone I just lent a book to
 * who isn't on LendShelf. Used by every invite entry point (E2).
 */
export function useInvite(): (toPhone?: string | null) => Promise<boolean> {
  const myPhone = useSessionStore((s) => s.user?.phoneNumber ?? null);
  return useCallback(
    (toPhone?: string | null) => {
      const text = inviteText({ myPhone });
      return toPhone ? openWhatsApp(toPhone, text) : shareInviteText(text);
    },
    [myPhone]
  );
}
