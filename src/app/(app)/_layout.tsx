import { Stack } from 'expo-router';

import { usePushRegistration } from '@/features/me/use-push-registration';
import { PushAskDialog } from '@/features/push-ask/push-ask-dialog';
import { useOpenPendingHref } from '@/hooks/use-pending-href';

export const unstable_settings = { anchor: '(tabs)' };

/** Signed-in app: tabs plus detail screens pushed on top. Screens render their own ScreenHeader. */
export default function AppLayout() {
  useOpenPendingHref();
  usePushRegistration();
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pick-copy" options={{ presentation: 'modal' }} />
        <Stack.Screen name="lend/[itemId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="review/[workId]" options={{ presentation: 'modal' }} />
      </Stack>
      {/* The in-context notification pre-prompt (C11). */}
      <PushAskDialog />
    </>
  );
}
