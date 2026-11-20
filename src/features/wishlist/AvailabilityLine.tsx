import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import type { Availability } from '@/features/wishlist/availability';

const DOT = {
  available: 'bg-emerald-500',
  lent: 'bg-amber-500',
  mine: 'bg-sky-500',
  none: 'bg-muted-foreground/40',
} as const;

/** Coloured dot + one-line availability text. */
export function AvailabilityLine({ availability }: { availability: Availability }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('size-2 rounded-full', DOT[availability.tone])} />
      <Text
        className={cn(
          'flex-1 text-xs',
          availability.tone === 'available'
            ? 'font-medium text-emerald-700 dark:text-emerald-400'
            : 'text-muted-foreground'
        )}
        numberOfLines={2}
      >
        {availability.text}
      </Text>
    </View>
  );
}
