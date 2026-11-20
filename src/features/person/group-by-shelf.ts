/**
 * A contact's shared copies grouped by their public collections, in the owner's shelf order.
 */
import { normaliseText } from '@/lib/search';

export interface ShelfGroup<T> {
  shelfId: string;
  /** null for copies whose collection isn't visible to me (shown as "Other books"). */
  name: string | null;
  items: T[];
}

export function groupItemsByShelf<T extends { shelfId: string; title: string }>(
  shelves: readonly { id: string; name: string }[],
  items: readonly T[]
): ShelfGroup<T>[] {
  const byShelf = new Map<string, T[]>();
  for (const item of items) {
    const list = byShelf.get(item.shelfId);
    if (list) list.push(item);
    else byShelf.set(item.shelfId, [item]);
  }
  const byTitle = (a: T, b: T) => normaliseText(a.title).localeCompare(normaliseText(b.title));

  const groups: ShelfGroup<T>[] = [];
  for (const shelf of shelves) {
    const list = byShelf.get(shelf.id);
    if (!list?.length) continue;
    groups.push({ shelfId: shelf.id, name: shelf.name, items: [...list].sort(byTitle) });
    byShelf.delete(shelf.id);
  }
  const rest = [...byShelf.values()].flat();
  if (rest.length) groups.push({ shelfId: '__other__', name: null, items: rest.sort(byTitle) });
  return groups;
}
