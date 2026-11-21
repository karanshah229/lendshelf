/** Push notifications aren't used on web (dev/demo build). Same surface as `push.ts`. */
import type { PushPermission } from '@/lib/push-permission';

export type { PushPermission } from '@/lib/push-permission';

export const PUSH_SUPPORTED = false;

export const ANDROID_CHANNEL_ID = 'default';

export async function getPushPermission(): Promise<PushPermission> {
  return 'unsupported';
}

export async function getPushPermissionState(): Promise<{
  permission: PushPermission;
  canAskAgain: boolean;
}> {
  return { permission: 'unsupported', canAskAgain: false };
}

export async function registerForPush(
  _uid: string,
  _opts: { prompt?: boolean } = {}
): Promise<PushPermission> {
  return 'unsupported';
}

export async function unregisterPush(_uid: string): Promise<void> {}

export function forgetPushRegistration(): void {}

export function openNotificationSettings(): void {}
