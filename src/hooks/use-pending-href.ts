import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { hrefFromPath } from '@/lib/notification-routes';
import { useSessionStore } from '@/stores/session';

/**
 * Root layout: keeps a `lendshelf://loan/…` (or `/copy/…`, `/book/…`, `/person/…`) link that
 * opened the app while it can't show it yet (signed out, onboarding), so it opens afterwards.
 * When the app is usable, Expo Router handles links itself.
 */
export function useKeepPendingLink(usable: boolean) {
  const url = Linking.useURL();
  useEffect(() => {
    if (!url || usable) return;
    const href = hrefFromPath(Linking.parse(url).path);
    if (href) useSessionStore.getState().setPendingHref(href);
  }, [url, usable]);
}

/**
 * Signed-in layout: opens the pending target (push tap or kept link) on top of the tabs and
 * clears it. After a cold start the tabs underneath open on Home, so Back lands there (F1).
 */
export function useOpenPendingHref() {
  const pending = useSessionStore((s) => s.pendingHref);
  useEffect(() => {
    if (!pending) return;
    useSessionStore.getState().setPendingHref(null);
    router.push(pending);
  }, [pending]);
}
