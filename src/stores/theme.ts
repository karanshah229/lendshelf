/**
 * Theme preference: follow the system, or force light/dark. Persisted per device and
 * applied through NativeWind's color scheme (see `useApplyTheme`).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/stores/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference(preference: ThemePreference): void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference(preference) {
        set({ preference });
      },
    }),
    { name: 'lendshelf.theme', version: 1, storage: persistStorage }
  )
);
