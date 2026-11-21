import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { backLabel, isOverdue } from '@/lib/dates';
import type { ItemStatus } from '@/types/model';

export interface StatusBadgeProps {
  status: ItemStatus;
  /** Show only "Lent out" without the date (e.g. very small cards). */
  compact?: boolean;
  className?: string;
}

/**
 * Copy status as contacts see it: "Available", "Lent · back 12 Dec" (or "overdue 3 days"),
 * "With you · back 12 Dec" (I'm the borrower), "Requested", "Not lendable", and "Hidden"
 * (owner only). Build the status with `itemStatus(item)` from `@/types/model`.
 */
export function StatusBadge({ status, compact, className }: StatusBadgeProps) {
  switch (status.kind) {
    case 'available':
      return (
        <Badge variant="success" className={className}>
          <Text>Available</Text>
        </Badge>
      );
    case 'requested':
      return (
        <Badge variant="warning" className={className}>
          <Text>Requested</Text>
        </Badge>
      );
    case 'notLendable':
      return (
        <Badge variant="outline" className={className}>
          <Text>Not lendable</Text>
        </Badge>
      );
    case 'hidden':
      return (
        <Badge variant="outline" className={className}>
          <Text>Hidden</Text>
        </Badge>
      );
    case 'lent': {
      const overdue = isOverdue(status.dueDate);
      const short = status.withMe ? 'With you' : 'Lent out';
      const long = status.withMe ? 'With you' : 'Lent';
      return (
        <Badge variant={overdue ? 'destructive' : 'secondary'} className={className}>
          <Text>
            {compact || !status.dueDate ? short : `${long} · ${backLabel(status.dueDate)}`}
          </Text>
        </Badge>
      );
    }
  }
}
