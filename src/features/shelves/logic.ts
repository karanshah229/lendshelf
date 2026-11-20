/** Pure helpers for the Collections screen: ordering and name validation. */
import { LIMITS } from '@/types/model';

export interface Orderable {
  id: string;
  sortOrder: number;
}

export interface SortOrderUpdate {
  id: string;
  sortOrder: number;
}

/**
 * Moves shelf `id` one place up or down in `ordered` (already in display order) and returns
 * the sortOrder writes needed so that the stored order is 0, 1, 2, … in the new order.
 * Only shelves whose sortOrder actually changes are returned. Empty when the move isn't possible.
 */
export function moveShelf(
  ordered: readonly Orderable[],
  id: string,
  direction: 'up' | 'down'
): SortOrderUpdate[] {
  const from = ordered.findIndex((s) => s.id === id);
  const to = direction === 'up' ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ordered.length) return [];
  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as Orderable);
  return next
    .map((s, index) => ({ id: s.id, sortOrder: index, before: s.sortOrder }))
    .filter((s) => s.sortOrder !== s.before)
    .map(({ id: sid, sortOrder }) => ({ id: sid, sortOrder }));
}

/** sortOrder for a new shelf: after the last one. */
export function nextSortOrder(shelves: readonly Orderable[]): number {
  return shelves.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1;
}

/** Collapses whitespace and trims. */
export function cleanShelfName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Error message for a shelf name, or null when it's fine. Names are unique per person (case-insensitive). */
export function validateShelfName(
  name: string,
  existing: readonly { id: string; name: string }[],
  exceptId?: string
): string | null {
  const clean = cleanShelfName(name);
  if (!clean) return 'Give the collection a name.';
  if (clean.length > LIMITS.shelfName) return `Keep it under ${LIMITS.shelfName} characters.`;
  const lower = clean.toLowerCase();
  if (existing.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === lower)) {
    return 'You already have a collection with that name.';
  }
  return null;
}

/**
 * Where a deleted shelf's copies go by default: the default shelf if it isn't the one being
 * deleted, otherwise the first other shelf. Null when there is no other shelf.
 */
export function defaultMoveTarget(
  ordered: readonly { id: string }[],
  deletingId: string,
  defaultId: string
): string | null {
  const others = ordered.filter((s) => s.id !== deletingId);
  return others.find((s) => s.id === defaultId)?.id ?? others[0]?.id ?? null;
}
