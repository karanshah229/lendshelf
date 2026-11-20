import { useEffect } from 'react';

import { registerForPush } from '@/lib/push';
import { useSessionStore } from '@/stores/session';

/** Delay so the permission prompt doesn't land on top of the first frame after onboarding. */
const PROMPT_DELAY_MS = 1200;

/**
 * Registers this device for push once the user is inside the signed-in app (i.e. after
 * onboarding, never on first launch). Mount once in `(app)/_layout.tsx`. No-op on web.
 */
export function usePushRegistration() {
  const uid = useSessionStore((s) => s.user?.uid);

  useEffect(() => {
    if (!uid) return;
    const timer = setTimeout(() => void registerForPush(uid), PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [uid]);
}
