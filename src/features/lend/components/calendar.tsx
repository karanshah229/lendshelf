import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  isSameDay,
  monthGrid,
  MONTH_NAMES,
  shiftMonth,
  WEEKDAY_LABELS,
} from '@/features/lend/due-date';
import { cn } from '@/lib/utils';

export interface CalendarProps {
  value: Date;
  onChange(date: Date): void;
  min: Date;
  max: Date;
  today?: Date;
}

/** Small month calendar (Monday first), web-safe, shadcn-style. */
export function Calendar({ value, onChange, min, max, today = new Date() }: CalendarProps) {
  const [ym, setYm] = useState({ year: value.getFullYear(), month: value.getMonth() });
  const weeks = monthGrid(ym.year, ym.month);
  const monthIndex = (y: number, m: number) => y * 12 + m;
  const current = monthIndex(ym.year, ym.month);
  const canPrev = current > monthIndex(min.getFullYear(), min.getMonth());
  const canNext = current < monthIndex(max.getFullYear(), max.getMonth());
  const minDay = new Date(min.getFullYear(), min.getMonth(), min.getDate()).getTime();
  const maxDay = new Date(max.getFullYear(), max.getMonth(), max.getDate()).getTime();

  return (
    <View className="gap-2 rounded-xl border border-border bg-card p-3">
      <View className="flex-row items-center justify-between">
        <NavButton
          icon={ChevronLeft}
          label="Previous month"
          disabled={!canPrev}
          onPress={() => setYm((v) => shiftMonth(v, -1))}
        />
        <Text className="text-sm font-semibold">
          {MONTH_NAMES[ym.month]} {ym.year}
        </Text>
        <NavButton
          icon={ChevronRight}
          label="Next month"
          disabled={!canNext}
          onPress={() => setYm((v) => shiftMonth(v, 1))}
        />
      </View>
      <View className="flex-row">
        {WEEKDAY_LABELS.map((d) => (
          <Text key={d} className="flex-1 text-center text-xs font-medium text-muted-foreground">
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row">
          {week.map((date, di) => {
            if (!date) return <View key={di} className="h-9 flex-1" />;
            const t = date.getTime();
            const disabled = t < minDay || t > maxDay;
            const selected = isSameDay(date, value);
            const isToday = isSameDay(date, today);
            return (
              <View key={di} className="h-9 flex-1 items-center justify-center">
                <Pressable
                  onPress={() => onChange(date)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={`${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`}
                  className={cn(
                    'size-9 items-center justify-center rounded-md',
                    selected ? 'bg-primary' : 'active:bg-accent',
                    !selected && isToday && 'bg-accent',
                    disabled && 'opacity-30'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm tabular-nums',
                      selected ? 'font-semibold text-primary-foreground' : 'text-foreground'
                    )}
                  >
                    {date.getDate()}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function NavButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof ChevronLeft;
  label: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        'size-8 items-center justify-center rounded-md border border-border active:bg-accent',
        disabled && 'opacity-30'
      )}
    >
      <Icon as={icon} size={16} className="text-foreground" />
    </Pressable>
  );
}
