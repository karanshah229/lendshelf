import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange(value: T): void;
  className?: string;
  size?: 'sm' | 'default';
}

/** shadcn-style tabs list: muted track with the active segment raised. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'default',
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      className={cn(
        'flex-row rounded-lg bg-muted p-[3px]',
        size === 'sm' ? 'h-8' : 'h-10',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            className={cn(
              'flex-1 flex-row items-center justify-center gap-1.5 rounded-md px-2',
              active && 'bg-background shadow-sm shadow-black/10 dark:bg-input/40'
            )}
          >
            {o.icon ? (
              <Icon
                as={o.icon}
                size={size === 'sm' ? 14 : 16}
                className={active ? 'text-foreground' : 'text-muted-foreground'}
              />
            ) : null}
            <Text
              numberOfLines={1}
              className={cn(
                'font-medium',
                size === 'sm' ? 'text-xs' : 'text-sm',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
