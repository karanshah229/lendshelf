/** Copy picker for "Lend a book" (E7): my copies on the shelf, lendable first, recent first. */
import type { Item, WithId } from '@/types/model';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const RANK: Record<Item['visibility'], number> = { lendable: 0, visible: 1, hidden: 2 };

/** `items` are expected newest first (as `useMyItems` returns them); the order is kept per group. */
export function pickableCopies<
  T extends Pick<Item, 'loanState' | 'visibility' | 'title' | 'authors'>,
>(items: readonly WithId<T>[], query = ''): WithId<T>[] {
  const q = norm(query);
  return items
    .filter((i) => i.loanState !== 'lent')
    .filter((i) => !q || norm([i.title, ...i.authors].join(' ')).includes(q))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => RANK[a.item.visibility] - RANK[b.item.visibility] || a.index - b.index)
    .map((x) => x.item);
}
