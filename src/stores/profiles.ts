/**
 * In-memory cache of other users' public profile fields (name, pickup note), fetched once
 * per session. Used to fall back to a profile name when someone isn't in your contacts.
 */
import { create } from 'zustand';

import { db, doc, getDoc } from '@/lib/firebase';
import { COLLECTIONS, fromSnap, type Profile } from '@/types/model';

export interface ProfileSummary {
  name: string;
  pickupNote: string | null;
}

export interface ProfilesState {
  /** uid → summary, or null when the profile doesn't exist / can't be read. */
  byUid: Record<string, ProfileSummary | null>;
  /** uids whose full profile document has been read this session. */
  fetched: Record<string, true>;
  /** Seeds names (e.g. from `syncContacts` results) without a read. */
  seedNames(entries: { uid: string; name: string }[]): void;
  /** Reads profiles that haven't been fetched yet (or all of them with `force`). */
  ensure(uids: readonly string[], opts?: { force?: boolean }): Promise<void>;
  clear(): void;
}

const inFlight = new Map<string, Promise<void>>();

export const useProfilesStore = create<ProfilesState>()((set, get) => ({
  byUid: {},
  fetched: {},
  seedNames(entries) {
    const byUid = { ...get().byUid };
    for (const { uid, name } of entries) {
      if (!byUid[uid]) byUid[uid] = { name, pickupNote: null };
    }
    set({ byUid });
  },
  async ensure(uids, opts) {
    const { fetched } = get();
    const missing = [...new Set(uids)].filter((u) => opts?.force || !fetched[u]);
    await Promise.all(
      missing.map((uid) => {
        const pending = inFlight.get(uid);
        if (pending) return pending;
        const p = getDoc(doc(db, COLLECTIONS.profiles, uid))
          .then((snap) => {
            const profile = fromSnap<Profile>(snap);
            set({
              byUid: {
                ...get().byUid,
                [uid]: profile ? { name: profile.name, pickupNote: profile.pickupNote } : null,
              },
              fetched: { ...get().fetched, [uid]: true },
            });
          })
          .catch(() => {
            // Keep any seeded name; don't retry within this session.
            set({ fetched: { ...get().fetched, [uid]: true } });
          })
          .finally(() => inFlight.delete(uid));
        inFlight.set(uid, p);
        return p;
      })
    );
  },
  clear() {
    set({ byUid: {}, fetched: {} });
  },
}));
