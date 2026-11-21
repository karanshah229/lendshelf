/**
 * Things the user dismissed on this device: the R14 "Keep both" choice on a Needs-you card
 * (`other:{loanId}`) and the Home setup card (`setup`). Persisted, so a dismissed card stays
 * gone after a restart. Keys are opaque strings owned by the feature that sets them.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage, rehydrateOnOtherTabWrites } from '@/stores/storage';

interface DismissedState {
  keys: string[];
  dismiss(key: string): void;
}

const KEY = 'lendshelf.dismissed';

export const useDismissedStore = create<DismissedState>()(
  persist(
    (set) => ({
      keys: [],
      dismiss(key) {
        set((s) => (s.keys.includes(key) ? s : { keys: [...s.keys, key].slice(-200) }));
      },
    }),
    {
      name: KEY,
      version: 1,
      storage: persistStorage,
      // Keys are only ever added: keep the ones in memory that another tab's copy lacks.
      merge: (persisted, current) => {
        const stored = (persisted as Partial<DismissedState> | undefined)?.keys ?? [];
        return { ...current, keys: [...new Set([...stored, ...current.keys])].slice(-200) };
      },
    }
  )
);

rehydrateOnOtherTabWrites(KEY, () => useDismissedStore.persist.rehydrate());
