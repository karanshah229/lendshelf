import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { Rating } from '@/types/model';

import { starFills } from '@/features/reviews/review-logic';

/** Read-only star row; supports half stars for averages. */
export function Stars({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const fills = starFills(value);
  return (
    <View
      className={cn('flex-row items-center gap-0.5', className)}
      accessibilityRole="image"
      accessibilityLabel={`${value} out of 5 stars`}
    >
      {fills.map((fill, i) => (
        <View key={i} style={{ width: size, height: size }}>
          <Icon
            as={Star}
            size={size}
            className="absolute text-muted-foreground/30"
            fill="currentColor"
            strokeWidth={0}
          />
          {fill > 0 ? (
            <View
              className="absolute left-0 top-0 h-full overflow-hidden"
              style={{ width: fill === 1 ? size : size / 2 }}
            >
              <Icon
                as={Star}
                size={size}
                className="text-amber-500"
                fill="currentColor"
                strokeWidth={0}
              />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Interactive 1–5 star picker. */
export function StarPicker({
  value,
  onChange,
  size = 40,
  disabled,
}: {
  value: number;
  onChange(rating: Rating): void;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2" accessibilityRole="radiogroup">
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const on = n <= value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            disabled={disabled}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ checked: n === value }}
            accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
            className="active:scale-90"
          >
            <Icon
              as={Star}
              size={size}
              strokeWidth={1.5}
              className={on ? 'text-amber-500' : 'text-muted-foreground/40'}
              fill={on ? 'currentColor' : 'transparent'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
