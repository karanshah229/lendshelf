import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { LoanSegment } from '@/features/loans/buckets';
import { cn } from '@/lib/utils';

export interface SegmentOption {
  value: LoanSegment;
  label: string;
  count: number;
  /** Highlight the count (something needs my attention). */
  alert?: boolean;
}

/** Full-width shadcn-style segmented control with count badges. */
export function Segmented({
  value,
  options,
  onChange,
}: {
  value: LoanSegment;
  options: SegmentOption[];
  onChange(value: LoanSegment): void;
}) {
  return (
    <View className="flex-row rounded-lg bg-muted p-1" accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${o.label}, ${o.count}`}
            className={cn(
              // Keep a `dark:` class in both states: NativeWind "upgrades" a component that
              // gains a variant after its first render, and on native that upgrade path
              // crashes in dev (stringifying navigation context).
              'h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-2 dark:bg-transparent',
              selected && 'bg-background shadow-sm shadow-black/10 dark:bg-input/40'
            )}
          >
            <Text
              numberOfLines={1}
              className={cn(
                'text-sm font-medium',
                selected ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {o.label}
            </Text>
            {o.count > 0 ? (
              <View
                className={cn(
                  'min-w-5 items-center rounded-full px-1.5 py-px',
                  o.alert ? 'bg-destructive' : selected ? 'bg-muted' : 'bg-foreground/10'
                )}
              >
                <Text
                  className={cn(
                    'text-[11px] font-semibold',
                    o.alert ? 'text-white' : 'text-muted-foreground'
                  )}
                >
                  {o.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
