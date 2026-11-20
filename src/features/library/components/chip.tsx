import type { LucideIcon } from 'lucide-react-native';
import { Platform, Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  /** Small number after the label. */
  count?: number;
  disabled?: boolean;
  className?: string;
  accessibilityLabel?: string;
}

/** Pill-shaped toggle used for collection switchers, filters and option pickers. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  count,
  disabled,
  className,
  accessibilityLabel,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      className={cn(
        'h-8 flex-row items-center gap-1.5 rounded-full border px-3',
        selected
          ? 'border-primary bg-primary'
          : cn(
              'border-border bg-background active:bg-accent dark:bg-input/30',
              Platform.select({ web: 'hover:bg-accent' })
            ),
        disabled && 'opacity-50',
        className
      )}
    >
      {icon ? (
        <Icon
          as={icon}
          size={14}
          className={selected ? 'text-primary-foreground' : 'text-muted-foreground'}
        />
      ) : null}
      <Text
        numberOfLines={1}
        className={cn(
          'text-sm font-medium',
          selected ? 'text-primary-foreground' : 'text-foreground'
        )}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          className={cn(
            'text-xs tabular-nums',
            selected ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
