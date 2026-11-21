import {
  afterSync,
  AUTO_RESYNC_INTERVAL_MS,
  DAY_MS,
  NEW_CHIP_MS,
  newOnLendShelf,
  newOwnerIdsAfterSync,
  newPeopleLine,
  shouldAutoResync,
  syncAnywayCopy,
  type AutoResyncInput,
} from '@/features/contacts/resync';

const NOW = Date.UTC(2026, 10, 21, 9);
const HOUR = 60 * 60 * 1000;

const input = (patch: Partial<AutoResyncInput> = {}): AutoResyncInput => ({
  hasAddressBook: true,
  permission: 'granted',
  onboarded: true,
  syncing: false,
  lastSyncedAt: NOW - 25 * HOUR,
  lastAutoSyncAt: null,
  now: NOW,
  ...patch,
});

describe('automatic re-sync on foreground (E13)', () => {
  it('syncs once the last sync is more than 24 h old', () => {
    expect(AUTO_RESYNC_INTERVAL_MS).toBe(DAY_MS);
    expect(shouldAutoResync(input())).toBe(true);
    expect(shouldAutoResync(input({ lastSyncedAt: NOW - 23 * HOUR }))).toBe(false);
    expect(shouldAutoResync(input({ lastSyncedAt: NOW - DAY_MS }))).toBe(true);
    // Never synced on this device (skipped onboarding, turned contacts on later).
    expect(shouldAutoResync(input({ lastSyncedAt: null }))).toBe(true);
  });

  it('only on a phone, with permission, after onboarding, when not already syncing', () => {
    expect(shouldAutoResync(input({ hasAddressBook: false }))).toBe(false);
    expect(shouldAutoResync(input({ permission: 'denied' }))).toBe(false);
    expect(shouldAutoResync(input({ permission: 'undetermined' }))).toBe(false);
    expect(shouldAutoResync(input({ permission: null }))).toBe(false);
    expect(shouldAutoResync(input({ permission: 'limited' }))).toBe(true);
    expect(shouldAutoResync(input({ onboarded: false }))).toBe(false);
    expect(shouldAutoResync(input({ syncing: true }))).toBe(false);
  });

  it('at most one automatic attempt a day, even when it failed (1 of the 20 daily calls)', () => {
    expect(shouldAutoResync(input({ lastAutoSyncAt: NOW - 2 * HOUR }))).toBe(false);
    expect(shouldAutoResync(input({ lastSyncedAt: null, lastAutoSyncAt: NOW - HOUR }))).toBe(
      false
    );
    expect(shouldAutoResync(input({ lastAutoSyncAt: NOW - 25 * HOUR }))).toBe(true);
    // 20 foregrounds in a day make one call.
    let calls = 0;
    let last: number | null = null;
    for (let i = 0; i < 20; i++) {
      const now = NOW + i * HOUR;
      if (shouldAutoResync(input({ now, lastAutoSyncAt: last }))) {
        calls++;
        last = now;
      }
    }
    expect(calls).toBe(1);
  });

  it('syncs right away when the user comes back from Settings with access on (E2a iii)', () => {
    expect(
      shouldAutoResync(input({ lastSyncedAt: NOW - HOUR, returnedFromSettings: true }))
    ).toBe(true);
    // …but not if access is still off.
    expect(
      shouldAutoResync(input({ permission: 'denied', returnedFromSettings: true }))
    ).toBe(false);
  });
});

describe('skipped removals (shrink guard, B1)', () => {
  it('a manual sync asks, an automatic one only notes it, never removing anyone', () => {
    expect(afterSync('manual', 9)).toBe('askSyncAnyway');
    expect(afterSync('auto', 9)).toBe('noteIncomplete');
    expect(afterSync('manual', 0)).toBe('done');
    expect(afterSync('auto', 0)).toBe('done');
  });

  it('the sheet says how many people would go', () => {
    expect(syncAnywayCopy(9)).toEqual({
      title: 'Your contacts look incomplete',
      body: '9 people in your circle are no longer in your contacts. If your contacts are still loading, for example on a new phone, keep everyone. Removing them means you stop seeing their books.',
    });
    expect(syncAnywayCopy(1).body).toMatch(/^1 person in your circle is no longer/);
  });
});

describe('"New on LendShelf"', () => {
  it('is whoever joined the circle in this sync, but nobody on the first sync', () => {
    expect(
      newOwnerIdsAfterSync({ before: ['a', 'b'], after: ['a', 'b', 'c'], hadPreviousSync: true })
    ).toEqual(['c']);
    expect(
      newOwnerIdsAfterSync({ before: [], after: ['a', 'b'], hadPreviousSync: false })
    ).toEqual([]);
    expect(
      newOwnerIdsAfterSync({ before: ['a'], after: ['a'], hadPreviousSync: true })
    ).toEqual([]);
  });

  it('shows for a week after that sync', () => {
    const ids = ['c'];
    expect([...newOnLendShelf({ newOwnerIds: ids, lastSyncedAt: NOW - DAY_MS, now: NOW })]).toEqual(
      ['c']
    );
    expect(
      newOnLendShelf({ newOwnerIds: ids, lastSyncedAt: NOW - NEW_CHIP_MS - 1, now: NOW }).size
    ).toBe(0);
    expect(newOnLendShelf({ newOwnerIds: ids, lastSyncedAt: null, now: NOW }).size).toBe(0);
  });

  it('a manual sync reports the new names inline', () => {
    expect(newPeopleLine(['Zoya', 'Kabir'])).toBe('2 new: Zoya, Kabir');
    expect(newPeopleLine([])).toBeNull();
  });
});
