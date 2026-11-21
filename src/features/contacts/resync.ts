/**
 * Contacts re-sync decisions (UX §E13, C10, R1/R6), pure:
 *
 * - When the app comes to the foreground, re-sync silently at most once per 24 h: native only,
 *   with contacts permission, after onboarding. 1 of the 20 daily `syncContacts` calls.
 * - An automatic sync never sends `replace: true`, so the server's shrink guard (B1) can't
 *   let it remove more than half the circle.
 * - When the guard reports `skippedRemovals`, a manual "Sync now" asks ("Sync anyway"),
 *   an automatic one just notes it for Me's Contacts row.
 * - People who weren't in the circle before the latest sync get "New on LendShelf".
 */
import type { ContactsPermission } from '@/lib/contacts';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Minimum time between automatic syncs, counted from the last sync or automatic attempt. */
export const AUTO_RESYNC_INTERVAL_MS = DAY_MS;
/** How long a person keeps the "New on LendShelf" chip after the sync that found them. */
export const NEW_CHIP_MS = 7 * DAY_MS;

const granted = (p: ContactsPermission | null) => p === 'granted' || p === 'limited';

export interface AutoResyncInput {
  /** False on web: no address book, nothing to re-read. */
  hasAddressBook: boolean;
  permission: ContactsPermission | null;
  /** Finished (or skipped) Find your people on this device. */
  onboarded: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  /** Last automatic attempt, successful or not. */
  lastAutoSyncAt: number | null;
  now: number;
  /**
   * The user went to Settings from "Turn on contacts" / "Open Settings" and came back: sync
   * right away so Home switches from case (iii) to (i) or (ii) (E2a).
   */
  returnedFromSettings?: boolean;
}

/** Should the app sync contacts now, silently? */
export function shouldAutoResync(input: AutoResyncInput): boolean {
  if (!input.hasAddressBook || !input.onboarded || input.syncing) return false;
  if (!granted(input.permission)) return false;
  if (input.returnedFromSettings) return true;
  const last = Math.max(input.lastSyncedAt ?? 0, input.lastAutoSyncAt ?? 0);
  return input.now - last >= AUTO_RESYNC_INTERVAL_MS;
}

export type SyncTrigger = 'auto' | 'manual';
export type AfterSync = 'done' | 'askSyncAnyway' | 'noteIncomplete';

/**
 * What to do with the result. Nothing was removed when `skippedRemovals > 0`: a manual sync
 * asks whether to remove those people (resending with `replace: true`); an automatic one keeps
 * everyone and Me shows "Some contacts weren't checked · Sync now".
 */
export function afterSync(trigger: SyncTrigger, skippedRemovals: number): AfterSync {
  if (skippedRemovals <= 0) return 'done';
  return trigger === 'manual' ? 'askSyncAnyway' : 'noteIncomplete';
}

/** The "Sync anyway" sheet (E13). */
export function syncAnywayCopy(n: number): { title: string; body: string } {
  const people = `${n} ${n === 1 ? 'person' : 'people'}`;
  return {
    title: 'Your contacts look incomplete',
    body: `${people} in your circle ${n === 1 ? 'is' : 'are'} no longer in your contacts. If your contacts are still loading, for example on a new phone, keep everyone. Removing them means you stop seeing their books.`,
  };
}

/**
 * Owners who appeared in this sync. The first sync on this device finds everyone, so nobody is
 * "new" then; afterwards, anyone who wasn't a link before is.
 */
export function newOwnerIdsAfterSync(input: {
  before: readonly string[];
  after: readonly string[];
  hadPreviousSync: boolean;
}): string[] {
  if (!input.hadPreviousSync) return [];
  const before = new Set(input.before);
  return [...new Set(input.after)].filter((id) => !before.has(id));
}

/** Owner ids that show the "New on LendShelf" chip now. */
export function newOnLendShelf(input: {
  newOwnerIds: readonly string[];
  lastSyncedAt: number | null;
  now: number;
}): ReadonlySet<string> {
  if (!input.lastSyncedAt || input.now - input.lastSyncedAt > NEW_CHIP_MS) return new Set();
  return new Set(input.newOwnerIds);
}

/** "2 new: Zoya, Kabir" after a manual sync (E13); null when nobody is new. */
export function newPeopleLine(names: readonly string[]): string | null {
  if (!names.length) return null;
  return `${names.length} new: ${names.join(', ')}`;
}
