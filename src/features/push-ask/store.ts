/**
 * Which users were already asked about notifications on this device (persisted), and the ask
 * on screen right now (not persisted). See `ask.ts`.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage, rehydrateOnOtherTabWrites } from '@/stores/storage';

import type { PushAskCopy, PushAskDecision } from './decision';

export interface PendingPushAsk {
  uid: string;
  decision: Exclude<PushAskDecision, 'none'>;
  copy: PushAskCopy;
}

interface PushAskState {
  /** uid → true once the pre-prompt (or the Android ≤ 12 line) was shown. */
  asked: Record<string, true>;
  pending: PendingPushAsk | null;
  markAsked(uid: string): void;
  show(pending: PendingPushAsk): void;
  close(): void;
}

const KEY = 'lendshelf.pushAsk';

export const usePushAskStore = create<PushAskState>()(
  persist(
    (set, get) => ({
      asked: {},
      pending: null,
      markAsked(uid) {
        if (!get().asked[uid]) set({ asked: { ...get().asked, [uid]: true } });
      },
      show(pending) {
        set({ pending });
      },
      close() {
        set({ pending: null });
      },
    }),
    {
      name: KEY,
      version: 1,
      storage: persistStorage,
      partialize: (s) => ({ asked: s.asked }),
      // Flags are only added: keep the union of the stored and in-memory ones.
      merge: (persisted, current) => ({
        ...current,
        asked: { ...((persisted as { asked?: Record<string, true> })?.asked ?? {}), ...current.asked },
      }),
    }
  )
);

rehydrateOnOtherTabWrites(KEY, () => usePushAskStore.persist.rehydrate());
