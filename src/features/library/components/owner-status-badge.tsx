import { CircleCheck, Clock, Eye, EyeOff, Lock, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { OwnerStatus } from '@/features/library/filter';
import { cn } from '@/lib/utils';

const ICONS: Record<OwnerStatus['kind'], LucideIcon> = {
  available: CircleCheck,
  lent: Clock,
  hidden: EyeOff,
  visibleOnly: Eye,
  private: Lock,
};

const BADGE_VARIANT = {
  success: 'success',
  lent: 'warning',
  overdue: 'destructive',
  muted: 'secondary',
} as const;

const TEXT_TONE = {
  success: 'text-emerald-700 dark:text-emerald-400',
  lent: 'text-amber-700 dark:text-amber-400',
  overdue: 'text-destructive',
  muted: 'text-muted-foreground',
} as const;

/** Badge for list rows: "Available", "Lent · back 12 Dec", "Hidden", … */
export function OwnerStatusBadge({ status }: { status: OwnerStatus }) {
  return (
    <Badge variant={BADGE_VARIANT[status.tone]}>
      <Text>{status.label}</Text>
    </Badge>
  );
}

/** Compact icon + short label for grid cards. */
export function OwnerStatusLine({
  status,
  className,
}: {
  status: OwnerStatus;
  className?: string;
}) {
  const tone = TEXT_TONE[status.tone];
  return (
    <View className={cn('flex-row items-center gap-1', className)}>
      <Icon as={ICONS[status.kind]} size={12} className={tone} />
      <Text numberOfLines={1} className={cn('flex-shrink text-xs font-medium', tone)}>
        {status.short}
      </Text>
    </View>
  );
}
