import { pushRowAction, toPushPermission } from '@/lib/push-permission';
import { pushAskDecision } from '@/features/push-ask/decision';

describe('push permission mapping (Android 13+, C11)', () => {
  it('denied with canAskAgain (POST_NOTIFICATIONS never requested) is not yet asked', () => {
    expect(toPushPermission({ status: 'denied', canAskAgain: true })).toBe('undetermined');
  });

  it('denied with canAskAgain false is blocked', () => {
    expect(toPushPermission({ status: 'denied', canAskAgain: false })).toBe('denied');
  });

  it('granted and undetermined map through', () => {
    expect(toPushPermission({ status: 'granted', canAskAgain: true })).toBe('granted');
    expect(toPushPermission({ status: 'granted', canAskAgain: false })).toBe('granted');
    expect(toPushPermission({ status: 'undetermined', canAskAgain: true })).toBe('undetermined');
  });

  it('Me › Notifications asks the OS while it can, and opens Settings only when blocked', () => {
    expect(pushRowAction(toPushPermission({ status: 'denied', canAskAgain: true }))).toBe(
      'request'
    );
    expect(pushRowAction(toPushPermission({ status: 'denied', canAskAgain: false }))).toBe(
      'openSettings'
    );
    expect(pushRowAction('granted')).toBe('none');
    expect(pushRowAction('unsupported')).toBe('none');
  });

  it('a fresh Android 13+ install gets the pre-prompt', () => {
    const res = { status: 'denied', canAskAgain: true };
    expect(
      pushAskDecision({
        supported: true,
        asked: false,
        permission: toPushPermission(res),
        canAskAgain: res.canAskAgain,
        legacyAndroid: false,
      })
    ).toBe('prePrompt');
  });

  it('a blocked permission gets no pre-prompt', () => {
    const res = { status: 'denied', canAskAgain: false };
    expect(
      pushAskDecision({
        supported: true,
        asked: false,
        permission: toPushPermission(res),
        canAskAgain: res.canAskAgain,
        legacyAndroid: false,
      })
    ).toBe('none');
  });
});
