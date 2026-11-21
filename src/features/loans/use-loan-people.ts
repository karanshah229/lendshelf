/**
 * Names, numbers and the "Not in your contacts" cue for the other person on a loan, as seen by
 * me. The name *I* saved them as wins on screen; outgoing WhatsApp text uses their profile name.
 */
import { useEffect, useMemo } from 'react';

import { useLinkMap } from '@/hooks/use-links';
import { formatPhone } from '@/lib/phone';
import { borrowerGreetName } from '@/lib/whatsapp';
import { useContactsStore } from '@/stores/contacts';
import { useProfilesStore } from '@/stores/profiles';
import { useSessionStore } from '@/stores/session';
import type { Loan } from '@/types/model';

export interface LoanPeople {
  /** The other person's display name: saved contact name → loan/profile name. */
  name(loan: Loan): string;
  /** Their number for WhatsApp, or null (non-app borrower without one, owner who left). */
  phone(loan: Loan): string | null;
  /** Their profile name, to greet them in WhatsApp text (null greets with "Hi!"). */
  greetName(loan: Loan): string | null;
  /** "Not in your contacts · +91 …" when I don't have them saved (one-way), else null. */
  notInContacts(loan: Loan): string | null;
  /** "On LendShelf as Ravi Menon" when their profile name differs from the name I saw. */
  profileAlias(loan: Loan): string | null;
  /** Their pickup note (when they're the owner). */
  pickupNote(loan: Loan): string | null;
}

/** Pass the loans on screen so their people's profiles are fetched. */
export function useLoanPeople(loans: readonly Loan[] = []): LoanPeople {
  const uid = useSessionStore((s) => s.user?.uid) ?? '';
  const linkMap = useLinkMap();
  const nameByPhone = useContactsStore((s) => s.nameByPhone);
  const profiles = useProfilesStore((s) => s.byUid);

  const otherUids = useMemo(() => {
    const set = new Set<string>();
    for (const l of loans) {
      const other = l.ownerId === uid ? l.borrowerUid : l.ownerId;
      if (other && other !== uid) set.add(other);
    }
    return [...set].sort();
  }, [loans, uid]);
  const key = otherUids.join(',');
  useEffect(() => {
    if (key) void useProfilesStore.getState().ensure(key.split(','));
  }, [key]);

  return useMemo<LoanPeople>(() => {
    const isOwner = (l: Loan) => l.ownerId === uid;
    const savedName = (l: Loan): string | null => {
      if (isOwner(l)) {
        return (
          (l.borrowerUid && linkMap.get(l.borrowerUid)?.contactName) ||
          (l.borrowerPhone && nameByPhone[l.borrowerPhone]) ||
          null
        );
      }
      return (
        linkMap.get(l.ownerId)?.contactName || (l.ownerPhone && nameByPhone[l.ownerPhone]) || null
      );
    };
    const profileName = (l: Loan): string | null => {
      const other = isOwner(l) ? l.borrowerUid : l.ownerId;
      return (other && profiles[other]?.name) || null;
    };
    return {
      name: (l) =>
        savedName(l) ||
        (isOwner(l)
          ? (l.borrowerUid && linkMap.get(l.borrowerUid)?.displayName) || l.borrowerName
          : linkMap.get(l.ownerId)?.displayName || l.ownerName) ||
        'Someone',
      phone: (l) => (isOwner(l) ? l.borrowerPhone : l.ownerPhone) || null,
      greetName: (l) =>
        isOwner(l)
          ? borrowerGreetName(l, profileName(l))
          : (profileName(l) ?? (l.ownerName || null)),
      notInContacts: (l) => {
        if (isOwner(l)) {
          // Only app users can be one-way; a hand-recorded borrower was typed in by me.
          if (!l.borrowerUid || linkMap.has(l.borrowerUid)) return null;
          if (l.borrowerPhone && nameByPhone[l.borrowerPhone]) return null;
          return l.borrowerPhone
            ? `Not in your contacts · ${formatPhone(l.borrowerPhone)}`
            : 'Not in your contacts';
        }
        if (linkMap.has(l.ownerId) || l.status === 'ownerLeft') return null;
        return l.ownerPhone
          ? `Not in your contacts · ${formatPhone(l.ownerPhone)}`
          : 'Not in your contacts';
      },
      profileAlias: (l) => {
        const saved = savedName(l);
        const prof = profileName(l);
        return saved && prof && saved.trim() !== prof.trim() ? `On LendShelf as ${prof}` : null;
      },
      pickupNote: (l) => (isOwner(l) ? null : (profiles[l.ownerId]?.pickupNote ?? null)),
    };
  }, [uid, linkMap, nameByPhone, profiles]);
}
