import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type PersistStorage } from 'zustand/middleware';

/** AsyncStorage-backed storage for zustand `persist` (localStorage on web). */
export const persistStorage = createJSONStorage(() => AsyncStorage);

/**
 * Storage that ignores writes until the store has read what's saved. zustand `persist` writes
 * the whole state on every `set`, including a `set` that runs before the first read finishes
 * (e.g. the auth listener firing early on a phone), which would replace saved data with the
 * defaults.
 */
export function writeOnlyAfterLoad<S>(
  storage: PersistStorage<S> | undefined,
  loaded: () => boolean
): PersistStorage<S> | undefined {
  if (!storage) return storage;
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => (loaded() ? storage.setItem(name, value) : undefined),
    removeItem: (name) => storage.removeItem(name),
  };
}

/**
 * Web only: re-reads a persisted store when another tab of the app writes it.
 *
 * zustand `persist` writes the *whole* persisted state on every `set`. Tabs of the web app share
 * localStorage (and Firebase Auth, so every tab reacts to a sign-in or sign-out), so a tab
 * that loaded earlier would otherwise write its stale copy back over a newer one, e.g. erasing
 * the "contacts step done" flag another tab just saved. With this, every tab keeps its in-memory
 * state up to date, so whatever it writes already includes the other tabs' changes.
 * No-op on native (one JS context per app).
 */
export function rehydrateOnOtherTabWrites(name: string, rehydrate: () => unknown): void {
  const w = globalThis as {
    localStorage?: unknown;
    addEventListener?: (type: 'storage', cb: (e: { key: string | null }) => void) => void;
  };
  if (!w.localStorage || typeof w.addEventListener !== 'function') return;
  w.addEventListener('storage', (e) => {
    // key null = localStorage.clear() in another tab.
    if (e.key === name || e.key === null) void rehydrate();
  });
}
