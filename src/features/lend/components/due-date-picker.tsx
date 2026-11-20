import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  DUE_PRESETS,
  matchPreset,
  maxDueDate,
  minDueDate,
  presetDate,
  relativeDueLabel,
} from '@/features/lend/due-date';
import { Chip } from '@/features/library/components/chip';
import { formatLongDate } from '@/lib/dates';

import { Calendar } from './calendar';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Quick chips (1w/2w/3w/1m) plus an inline calendar for any other day. */
export function DueDatePicker({ value, onChange }: { value: Date; onChange(d: Date): void }) {
  const now = new Date();
  const preset = matchPreset(value, now);
  const [showCalendar, setShowCalendar] = useState(false);

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {DUE_PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            selected={!showCalendar && preset === p.id}
            onPress={() => {
              setShowCalendar(false);
              onChange(presetDate(p.id, now));
            }}
          />
        ))}
        <Chip
          label="Pick a date"
          icon={CalendarDays}
          selected={showCalendar || !preset}
          onPress={() => setShowCalendar((s) => !s)}
        />
      </View>
      {showCalendar ? (
        <Calendar
          value={value}
          onChange={onChange}
          min={minDueDate(now)}
          max={maxDueDate(now)}
          today={now}
        />
      ) : null}
      <View className="flex-row items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5">
        <Icon as={CalendarDays} size={16} className="text-muted-foreground" />
        <Text className="text-sm">
          Back by{' '}
          <Text className="text-sm font-semibold">
            {WEEKDAYS[value.getDay()]}, {formatLongDate(value)}
          </Text>
          <Text className="text-sm text-muted-foreground"> · {relativeDueLabel(value, now)}</Text>
        </Text>
      </View>
    </View>
  );
}
