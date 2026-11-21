/**
 * Maps what `expo-notifications` reports to the app's push permission, pure (shared by
 * `push.ts`; tested on its own).
 *
 * Android 13+ reports `denied` with `canAskAgain: true` before POST_NOTIFICATIONS was ever
 * requested (and after a single "Don't allow", when Android still lets the app ask once more).
 * The system dialog can still be shown, so that is `undetermined`: the pre-prompt may run and
 * Me › Notifications asks directly. Only `denied` with `canAskAgain: false` (blocked) is
 * `denied`, which is the one case that needs the system settings page.
 */
export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export function toPushPermission(res: {
  status: string;
  canAskAgain?: boolean;
  granted?: boolean;
}): PushPermission {
  if (res.status === 'granted' || res.granted) return 'granted';
  if (res.status === 'denied' && res.canAskAgain === false) return 'denied';
  return 'undetermined';
}

/** What Me › Notifications does when tapped. */
export type PushRowAction = 'request' | 'openSettings' | 'none';

export function pushRowAction(permission: PushPermission): PushRowAction {
  if (permission === 'undetermined') return 'request';
  if (permission === 'denied') return 'openSettings';
  return 'none';
}
