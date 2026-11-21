import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { routeForNotification } from '@/lib/notification-routes';
import { useSessionStore } from '@/stores/session';

/**
 * Turns a tapped push (including the one that launched the app) into the session's pending
 * target. Mount once in the root layout, so taps that arrive while signed out or mid-onboarding
 * are kept (F1 rule 4); `useOpenPendingHref` in the signed-in layout opens it.
 * The web build uses a no-op.
 */
export function useNotificationRouting() {
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const href = routeForNotification(last.notification.request.content.data);
    if (href) useSessionStore.getState().setPendingHref(href);
    Notifications.clearLastNotificationResponse();
  }, [last]);
}
