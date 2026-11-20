import '../../global.css';

import { PortalHost } from '@rn-primitives/portal';
import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';

import { SessionBootstrap } from '@/components/session-bootstrap';
import { useApplyTheme, useColorScheme } from '@/hooks/use-color-scheme';
import { NAV_THEME } from '@/lib/theme';
import { useContactsHydrated, useContactsStore } from '@/stores/contacts';
import { selectStatus, useSessionStore } from '@/stores/session';

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useApplyTheme();
  const { colorScheme, isDark } = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={NAV_THEME[colorScheme]}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <SessionBootstrap />
          <RootNavigator />
          <Toaster
            position="top-center"
            richColors
            theme={isDark ? 'dark' : 'light'}
            duration={3500}
          />
          <PortalHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Auth gate (Expo Router protected routes):
 *   signed out            → (auth)/phone → (auth)/code
 *   signed in, no profile → (onboarding)/name
 *   profile, contacts step not done on this device → contacts
 *   otherwise             → (app): tabs and detail screens
 */
function RootNavigator() {
  const status = useSessionStore(selectStatus);
  const uid = useSessionStore((s) => s.user?.uid);
  const hydrated = useContactsHydrated();
  const onboarded = useContactsStore((s) => (uid ? !!s.onboarded[uid] : false));

  const loading = status === 'loading' || !hydrated;
  const ready = status === 'ready';
  const needsContacts = ready && !onboarded;

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)/phone" />
        <Stack.Screen name="(auth)/code" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needsProfile'}>
        <Stack.Screen name="(onboarding)/name" />
      </Stack.Protected>
      <Stack.Protected guard={ready && !needsContacts}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="contacts" />
      </Stack.Protected>
    </Stack>
  );
}
