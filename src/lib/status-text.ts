import { backLabel, isOverdue } from '@/lib/dates';
import type { ItemStatus } from '@/types/model';

/**
 * The words on a copy's status badge (UX F6), also used in screen-reader labels so a status is
 * never carried by colour alone (F8): "Available", "Requested", "Not lending", "Hidden",
 * "Lent · back 12 Dec", "Lent · overdue 3 days", "With you · back 12 Dec", "Out · back 12 Dec".
 * `compact` drops the date, but an overdue copy still says "Overdue".
 */
export function statusBadgeText(
  status: ItemStatus,
  { compact = false, owner = false }: { compact?: boolean; owner?: boolean } = {},
  now: Date = new Date()
): string {
  switch (status.kind) {
    case 'available':
      return 'Available';
    case 'requested':
      return 'Requested';
    case 'notLendable':
      return 'Not lending';
    case 'hidden':
      return 'Hidden';
    case 'lent': {
      const short = status.withMe ? 'With you' : owner ? 'Out' : 'Lent';
      if (!status.dueDate) return short;
      if (compact) return isOverdue(status.dueDate, now) ? `${short} · overdue` : short;
      return `${short} · ${backLabel(status.dueDate, now)}`;
    }
  }
}
