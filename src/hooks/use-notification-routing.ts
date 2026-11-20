import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { routeForNotification } from '@/lib/notification-routes';

/**
 * Opens the right screen when the user taps a push notification (including the one that
 * launched the app). Mount once inside the signed-in app layout. The web build uses a no-op.
 */
export function useNotificationRouting() {
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const href = routeForNotification(last.notification.request.content.data);
    if (href) router.push(href);
    Notifications.clearLastNotificationResponse();
  }, [last]);
}
