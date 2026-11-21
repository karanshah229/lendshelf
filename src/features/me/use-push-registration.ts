import { useEffect } from 'react';

import { registerForPush } from '@/lib/push';
import { useSessionStore } from '@/stores/session';

/**
 * Registers this device for push on every start of the signed-in app, silently: it never shows
 * the system dialog (C11), so a user who already allowed notifications stays registered and
 * everyone else is asked in context (`askForPushInContext`). Mount once in `(app)/_layout.tsx`.
 * No-op on web.
 */
export function usePushRegistration() {
  const uid = useSessionStore((s) => s.user?.uid);

  useEffect(() => {
    if (uid) void registerForPush(uid, { prompt: false });
  }, [uid]);
}
