/**
 * Push notifications (Expo push service, DECISIONS #6). Native only; `push.web.ts` is a no-op.
 *
 * - Never asked for on start (C11): the signed-in layout registers silently when permission is
 *   already granted, and the system dialog is shown only after the in-context pre-prompt
 *   (`src/features/push-ask`) or from Me › Notifications.
 * - The Expo push token is registered with the `registerPushToken` callable (which also removes
 *   it from any other account on this device, DECISIONS #26) and removed again on sign-out with
 *   `unregisterPushToken`.
 * - Needs an EAS project id: `extra.eas.projectId`, which app.config.ts fills from
 *   EAS_PROJECT_ID_DEFAULT, EAS_PROJECT_ID(_DEV/_PROD) or a static app.json (`eas init` can't
 *   edit the dynamic config). Setup: README → Push notifications setup.
 *   Without it, registration is skipped with a warning: everything else keeps working.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { api } from '@/lib/api';
import { toPushPermission, type PushPermission } from '@/lib/push-permission';

export type { PushPermission } from '@/lib/push-permission';

export const PUSH_SUPPORTED = true;

/** Android channel every LendShelf push is posted to (the backend sends no channelId). */
export const ANDROID_CHANNEL_ID = 'default';

let handlerSet = false;
/** Token registered for the signed-in user on this device (removed on sign-out). */
let registered: { uid: string; token: string } | null = null;

/** Show pushes as banners while the app is open (no sound, no badge). */
function ensureForegroundHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Loans and reminders',
    description: 'Borrow requests, returns, due dates and wishlist books',
    // Re-exported through `export *`, which eslint-plugin-import can't follow here.
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
  });
}

function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const fromExtra = extra?.eas?.projectId;
  if (typeof fromExtra === 'string' && fromExtra) return fromExtra;
  const fromEas = Constants.easConfig?.projectId;
  return typeof fromEas === 'string' && fromEas ? fromEas : null;
}

/** Current notification permission without prompting. */
export async function getPushPermission(): Promise<PushPermission> {
  if (!Device.isDevice) return 'unsupported';
  return toPushPermission(await Notifications.getPermissionsAsync());
}

/** Permission plus whether the system dialog can still be shown (for the in-context ask, C11). */
export async function getPushPermissionState(): Promise<{
  permission: PushPermission;
  canAskAgain: boolean;
}> {
  if (!Device.isDevice) return { permission: 'unsupported', canAskAgain: false };
  const res = await Notifications.getPermissionsAsync();
  return { permission: toPushPermission(res), canAskAgain: res.canAskAgain };
}

/**
 * Gets the Expo push token and registers it for `uid` (`registerPushToken`). With
 * `prompt: false` (every app start) it only registers when permission is already granted;
 * with `prompt: true` (after the in-context pre-prompt, or Me › Notifications) it first shows
 * the system dialog if it can still be shown. Returns the resulting permission.
 * Never throws: failures are logged, the app works without push.
 */
export async function registerForPush(
  uid: string,
  { prompt = true }: { prompt?: boolean } = {}
): Promise<PushPermission> {
  try {
    ensureForegroundHandler();
    if (!Device.isDevice) return 'unsupported';
    // The channel must exist before the Android 13+ permission prompt can appear.
    await ensureAndroidChannel();

    let perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted' && perm.canAskAgain && prompt) {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (perm.status !== 'granted') return toPushPermission(perm);

    const projectId = easProjectId();
    if (!projectId) {
      console.warn(
        '[push] No EAS projectId (extra.eas.projectId) in the app config; skipping push registration.'
      );
      return 'granted';
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (registered?.uid === uid && registered.token === token) return 'granted';
    await api.registerPushToken({ token });
    registered = { uid, token };
    return 'granted';
  } catch (e) {
    console.warn('[push] Registration failed', e);
    return getPushPermission().catch(() => 'undetermined' as const);
  }
}

/** Removes this device's token from `users/{uid}`. Call before signing out (needs auth). */
export async function unregisterPush(uid: string): Promise<void> {
  const current = registered;
  if (!current || current.uid !== uid) return;
  registered = null;
  try {
    await api.unregisterPushToken({ token: current.token });
  } catch (e) {
    console.warn('[push] Could not remove the push token', e);
  }
}

/** Forgets the local registration without touching Firestore (e.g. after account deletion). */
export function forgetPushRegistration(): void {
  registered = null;
}

/** Opens the system settings page for this app (to turn notifications back on). */
export function openNotificationSettings(): void {
  void Linking.openSettings();
}
