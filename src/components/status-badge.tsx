import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { isOverdue } from '@/lib/dates';
import { statusBadgeText } from '@/lib/status-text';
import type { ItemStatus } from '@/types/model';

export { statusBadgeText };

export interface StatusBadgeProps {
  status: ItemStatus;
  /** Show only "Lent" without the date (e.g. very small cards); an overdue copy still says so. */
  compact?: boolean;
  /** The owner's own view: a lent copy reads "Out · back 12 Dec" instead of "Lent · …" (F6). */
  owner?: boolean;
  className?: string;
}

const VARIANT = {
  available: 'success',
  requested: 'warning',
  notLendable: 'outline',
  hidden: 'outline',
} as const;

/**
 * Copy status as contacts see it (UX F6): "Available", "Lent · back 12 Dec" (or "overdue 3 days"),
 * "With you · back 12 Dec" (I'm the borrower), "Requested", "Not lending", and "Hidden"
 * (owner only). With `owner`, a lent copy reads "Out · back 12 Dec". Build the status with `itemStatus(item)` from `@/types/model`.
 * The colour only repeats the words (F8): see `statusBadgeText`.
 */
export function StatusBadge({ status, compact, owner, className }: StatusBadgeProps) {
  const variant =
    status.kind === 'lent'
      ? isOverdue(status.dueDate)
        ? 'destructive'
        : 'secondary'
      : VARIANT[status.kind];
  return (
    <Badge variant={variant} className={className}>
      <Text>{statusBadgeText(status, { compact, owner })}</Text>
    </Badge>
  );
}
