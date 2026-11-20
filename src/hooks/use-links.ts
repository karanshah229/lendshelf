import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { formatPhone } from '@/lib/phone';
import { useContactsStore } from '@/stores/contacts';
import { useProfilesStore } from '@/stores/profiles';
import { useSessionStore } from '@/stores/session';

/** A person whose number I have saved and who is on LendShelf. */
export interface LinkedOwner {
  ownerId: string;
  ownerPhone: string;
  /** Name I saved them as → their profile name → formatted number. */
  displayName: string;
  contactName: string | null;
  profileName: string | null;
}

/**
 * People I have saved (links where viewerId == me) joined with my contact names,
 * sorted by display name. Backed by one app-wide listener (see SessionBootstrap).
 */
export function useLinks(): { links: LinkedOwner[]; loading: boolean; error: Error | null } {
  const { data, loading, error } = useSessionStore(
    useShallow((s) => ({ data: s.links, loading: s.linksLoading, error: s.linksError }))
  );
  const nameByPhone = useContactsStore((s) => s.nameByPhone);
  const profiles = useProfilesStore((s) => s.byUid);

  const ownerIds = useMemo(() => data.map((l) => l.ownerId), [data]);
  useEffect(() => {
    if (ownerIds.length) void useProfilesStore.getState().ensure(ownerIds);
  }, [ownerIds]);

  const links = useMemo(
    () =>
      data
        .map((l): LinkedOwner => {
          const contactName = nameByPhone[l.ownerPhone] ?? null;
          const profileName = profiles[l.ownerId]?.name ?? null;
          return {
            ownerId: l.ownerId,
            ownerPhone: l.ownerPhone,
            contactName,
            profileName,
            displayName: contactName || profileName || formatPhone(l.ownerPhone),
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [data, nameByPhone, profiles]
  );

  return { links, loading, error };
}

/** ownerId → LinkedOwner lookup. */
export function useLinkMap(): Map<string, LinkedOwner> {
  const { links } = useLinks();
  return useMemo(() => new Map(links.map((l) => [l.ownerId, l])), [links]);
}

/** Display name for any user: contact name → profile name → fallback. */
export function useDisplayName(uid: string | null | undefined, fallback = 'Someone'): string {
  const linkMap = useLinkMap();
  const me = useSessionStore((s) => s.user?.uid);
  const myName = useSessionStore((s) => s.profile?.name);
  const profileName = useProfilesStore((s) => (uid ? s.byUid[uid]?.name : undefined));
  useEffect(() => {
    if (uid && uid !== me) void useProfilesStore.getState().ensure([uid]);
  }, [uid, me]);
  if (!uid) return fallback;
  if (uid === me) return myName ?? 'You';
  return linkMap.get(uid)?.displayName ?? profileName ?? fallback;
}
