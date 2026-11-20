import {
  colorScheme as nwColorScheme,
  useColorScheme as useNativewindColorScheme,
} from 'nativewind';
import { useEffect } from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { useThemeStore, type ThemePreference } from '@/stores/theme';

/**
 * The effective color scheme plus the user's preference ('system' | 'light' | 'dark').
 * Use `isDark` for things NativeWind classes can't reach (icon colors, navigation theme).
 */
export function useColorScheme(): {
  colorScheme: 'light' | 'dark';
  isDark: boolean;
  preference: ThemePreference;
  setPreference(preference: ThemePreference): void;
} {
  const { colorScheme } = useNativewindColorScheme();
  const { preference, setPreference } = useThemeStore(
    useShallow((s) => ({ preference: s.preference, setPreference: s.setPreference }))
  );
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  return { colorScheme: scheme, isDark: scheme === 'dark', preference, setPreference };
}

/** Applies the stored preference to NativeWind. Mount once, in the root layout. */
export function useApplyTheme() {
  const preference = useThemeStore((s) => s.preference);
  const system = useSystemColorScheme();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // On web NativeWind's 'system' drops the `dark` class; resolve it ourselves.
      nwColorScheme.set(
        preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference
      );
    } else {
      nwColorScheme.set(preference);
    }
  }, [preference, system]);
}
