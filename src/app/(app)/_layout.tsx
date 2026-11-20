import { Stack } from 'expo-router';

import { useNotificationRouting } from '@/hooks/use-notification-routing';

export const unstable_settings = { anchor: '(tabs)' };

/** Signed-in app: tabs plus detail screens pushed on top. Screens render their own ScreenHeader. */
export default function AppLayout() {
  useNotificationRouting();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add" options={{ presentation: 'modal' }} />
      <Stack.Screen name="lend/[itemId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="review/[workId]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
