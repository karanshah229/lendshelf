import {
  isLegacyAndroid,
  pushAskCopy,
  pushAskDecision,
} from '@/features/push-ask/decision';

const base = {
  supported: true,
  asked: false,
  permission: 'undetermined' as const,
  canAskAgain: true,
  legacyAndroid: false,
};

describe('notification permission in context (C11)', () => {
  it('asks with a pre-prompt the first time, while the system dialog can still be shown', () => {
    expect(pushAskDecision(base)).toBe('prePrompt');
  });

  it('asks once per user', () => {
    expect(pushAskDecision({ ...base, asked: true })).toBe('none');
  });

  it('does nothing when already on, blocked, or without push (web, simulator)', () => {
    expect(pushAskDecision({ ...base, permission: 'granted' })).toBe('none');
    expect(pushAskDecision({ ...base, permission: 'denied', canAskAgain: false })).toBe('none');
    expect(pushAskDecision({ ...base, canAskAgain: false })).toBe('none');
    expect(pushAskDecision({ ...base, supported: false })).toBe('none');
    expect(pushAskDecision({ ...base, permission: 'unsupported' })).toBe('none');
  });

  it('on Android 12 and below (no runtime prompt) shows the one-time line instead', () => {
    expect(isLegacyAndroid('android', 32)).toBe(true);
    expect(isLegacyAndroid('android', 33)).toBe(false);
    expect(isLegacyAndroid('ios', '17.0')).toBe(false);
    expect(pushAskDecision({ ...base, legacyAndroid: true, permission: 'granted' })).toBe(
      'legacyNote'
    );
    expect(
      pushAskDecision({ ...base, legacyAndroid: true, permission: 'granted', asked: true })
    ).toBe('none');
    // Turned off for the app in system settings: nothing will be sent, so nothing to explain.
    expect(pushAskDecision({ ...base, legacyAndroid: true, permission: 'denied' })).toBe('none');
  });

  it('the pre-prompt is one line about the thing just done', () => {
    expect(pushAskCopy('prePrompt', 'request', { name: 'Ravi Menon' })).toEqual({
      title: 'Get told when Ravi answers?',
      body: 'LendShelf sends a notification when Ravi accepts or declines your request.',
      confirm: 'Turn on notifications',
      cancel: 'Not now',
    });
    expect(pushAskCopy('prePrompt', 'accept', { title: 'Animal Farm' }).title).toBe(
      'Get reminded when it’s due?'
    );
    expect(pushAskCopy('prePrompt', 'lend', { title: 'Animal Farm' }).body).toBe(
      'LendShelf sends a reminder before “Animal Farm” is due back, and tells you when it’s returned.'
    );
    expect(pushAskCopy('prePrompt', 'wishlist').title).toBe('Get told when a friend has it?');
    for (const reason of ['request', 'accept', 'lend', 'wishlist'] as const) {
      expect(pushAskCopy('prePrompt', reason).body.split('. ').length).toBe(1);
    }
  });

  it('the Android ≤ 12 line says what will be sent, with OK only', () => {
    const c = pushAskCopy('legacyNote', 'lend', { title: 'Animal Farm' });
    expect(c.body).toMatch(/before “Animal Farm” is due back/);
    expect(c.confirm).toBe('OK');
    expect(c.cancel).toBeNull();
  });
});
