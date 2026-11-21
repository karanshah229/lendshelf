/**
 * The hook point for C11: call after a successful request, accept, recorded loan or wishlist
 * add. Shows the pre-prompt the first time only (per user, on this device); does nothing on web,
 * when notifications are already on, or when the system no longer lets the app ask.
 *
 *   void askForPushInContext('request', { name: 'Ravi Menon', title: 'Animal Farm' });
 */
import { Platform } from 'react-native';

import { getPushPermissionState, PUSH_SUPPORTED, registerForPush } from '@/lib/push';
import { useSessionStore } from '@/stores/session';

import { isLegacyAndroid, pushAskCopy, pushAskDecision, type PushAskReason } from './decision';
import { usePushAskStore } from './store';

export async function askForPushInContext(
  reason: PushAskReason,
  ctx: { name?: string | null; title?: string | null } = {}
): Promise<void> {
  const uid = useSessionStore.getState().user?.uid;
  if (!uid || !PUSH_SUPPORTED) return;
  const store = usePushAskStore.getState();
  if (store.asked[uid] || store.pending) return;
  try {
    const { permission, canAskAgain } = await getPushPermissionState();
    const decision = pushAskDecision({
      supported: PUSH_SUPPORTED,
      asked: !!usePushAskStore.getState().asked[uid],
      permission,
      canAskAgain,
      legacyAndroid: isLegacyAndroid(Platform.OS, Platform.Version),
    });
    if (decision === 'none') return;
    usePushAskStore.getState().markAsked(uid);
    usePushAskStore.getState().show({ uid, decision, copy: pushAskCopy(decision, reason, ctx) });
  } catch {
    // Push is optional; never block the action that triggered the ask.
  }
}

/** "Turn on notifications" on the pre-prompt: now the system dialog, then registration. */
export async function acceptPushAsk(uid: string): Promise<void> {
  await registerForPush(uid, { prompt: true });
}
