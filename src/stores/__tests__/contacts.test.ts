/**
 * The "Find your people done" flag must survive reloads, sign-out/sign-in and other copies of
 * the app writing their state (web tabs share storage). Each `load()` below is a separate copy
 * of the store, like a new app start or another browser tab, over one shared storage.
 */
import {
  isOnboarded,
  mergeContactsState,
  useContactsStore as currentStore,
  type ContactsState,
} from '@/stores/contacts';

const mockData = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockData.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockData.set(k, v),
    removeItem: async (k: string) => void mockData.delete(k),
  },
}));

const KEY = 'lendshelf.contacts';
type Store = typeof currentStore;

function freshCopy(): Store {
  let store!: Store;
  jest.isolateModules(() => {
    // A new module registry is the only way to get a second instance of the store.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = (require('@/stores/contacts') as { useContactsStore: Store }).useContactsStore;
  });
  return store;
}

/** A fresh copy of the store module (an app start or another tab), after it read storage. */
async function load(): Promise<Store> {
  const store = freshCopy();
  if (!store.persist.hasHydrated()) {
    await new Promise<void>((resolve) => store.persist.onFinishHydration(() => resolve()));
  }
  return store;
}

const savedFlags = () =>
  (JSON.parse(mockData.get(KEY) ?? '{"state":{}}') as { state: { onboarded?: object } }).state
    .onboarded ?? {};

const flagged = (store: Store, uid: string) => isOnboarded(store.getState().onboarded, uid);

describe('contacts onboarding flag ("Find your people" done on this device)', () => {
  beforeEach(() => mockData.clear());

  it('is per user', () => {
    expect(isOnboarded({ u1: true }, 'u1')).toBe(true);
    expect(isOnboarded({ u1: true }, 'u2')).toBe(false);
    expect(isOnboarded({ u1: true }, null)).toBe(false);
  });

  it('is read back after a reload', async () => {
    const before = await load();
    before.getState().markOnboarded('u1');
    expect(savedFlags()).toEqual({ u1: true });
    expect(flagged(await load(), 'u1')).toBe(true);
  });

  it('survives sign-out and signing in again', async () => {
    const app = await load();
    app.getState().setCurrentUid('u1');
    app.getState().markOnboarded('u1');
    app.getState().reset(); // sign-out
    app.getState().setCurrentUid('u1'); // same number again
    expect(flagged(app, 'u1')).toBe(true);
    expect(flagged(await load(), 'u1')).toBe(true);
  });

  it('is not erased by another tab that loaded before it was set (the bug)', async () => {
    const tabB = await load(); // an older tab, loaded before the step was done
    const tabA = await load();
    tabA.getState().markOnboarded('u1');

    // Web: tab B re-reads on tab A's write (the `storage` event), then writes its own change.
    await tabB.persist.rehydrate();
    tabB.getState().setCurrentUid('u1'); // e.g. Firebase Auth syncing the sign-in to tab B
    expect(savedFlags()).toEqual({ u1: true });

    // Even if tab B wrote a stale copy first, tab A's next re-read keeps its flag and writes it back.
    mockData.set(KEY, JSON.stringify({ state: { onboarded: { u0: true } }, version: 1 }));
    await tabA.persist.rehydrate();
    expect(tabA.getState().onboarded).toEqual({ u0: true, u1: true });
    tabA.getState().setSyncing(false);
    expect(flagged(await load(), 'u1')).toBe(true);
  });

  it('is not overwritten by a write that happens before the saved state was read', async () => {
    mockData.set(KEY, JSON.stringify({ state: { onboarded: { u1: true } }, version: 1 }));
    const store = freshCopy();
    // The auth listener fires before the read finishes (possible on a phone).
    store.getState().setCurrentUid('u1');
    expect(savedFlags()).toEqual({ u1: true });
    await new Promise<void>((resolve) =>
      store.persist.hasHydrated() ? resolve() : store.persist.onFinishHydration(() => resolve())
    );
    expect(flagged(store, 'u1')).toBe(true);
  });
});

describe('mergeContactsState', () => {
  const current = (patch: Partial<ContactsState> = {}): ContactsState => ({
    ...currentStore.getInitialState(),
    ...patch,
  });

  it('unions onboarding flags; other stored values win', () => {
    const merged = mergeContactsState(
      { onboarded: { a: true }, linkCount: 4, lastSyncedAt: 10 },
      current({ onboarded: { b: true }, linkCount: 1, lastSyncedAt: 5 })
    );
    expect(merged.onboarded).toEqual({ a: true, b: true });
    expect(merged.linkCount).toBe(4);
    expect(merged.lastSyncedAt).toBe(10);
  });

  it('rebuilds the current user’s manual contacts and keeps unstored fields', () => {
    const asha = { name: 'Asha', phone: '+919000000001' };
    const merged = mergeContactsState(
      { manualByUid: { u1: [asha] } },
      current({ currentUid: 'u1', syncing: true, permission: 'granted' })
    );
    expect(merged.manualContacts).toEqual([asha]);
    expect(merged.syncing).toBe(true);
    expect(merged.permission).toBe('granted');
    expect(merged.currentUid).toBe('u1');
  });

  it('copes with nothing stored and with state saved before the new fields existed', () => {
    expect(mergeContactsState(undefined, current({ onboarded: { a: true } })).onboarded).toEqual({
      a: true,
    });
    const old = mergeContactsState({ onboarded: { a: true }, linkCount: 2 }, current());
    expect(old.skippedRemovals).toBe(0);
    expect(old.newOwnerIds).toEqual([]);
  });
});
