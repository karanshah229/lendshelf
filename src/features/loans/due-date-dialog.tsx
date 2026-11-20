import { CalendarDays, Minus, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  acceptChips,
  clampDueDate,
  defaultDueDate,
  extendChips,
  relativeDueHint,
  sameDay,
  shiftDueDate,
} from '@/features/loans/due-dates';
import { addDays, formatLongDate, startOfDay } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { TimestampLike } from '@/types/model';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface DueDateDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** 'accept' counts chips from today; 'change' extends the current due date. */
  mode: 'accept' | 'change';
  title: string;
  description?: string;
  /** Current due date (change mode). */
  currentDue?: TimestampLike | null;
  confirmLabel: string;
  /** Resolve to close; throw to keep the dialog open. */
  onConfirm(date: Date): Promise<void>;
}

/**
 * Due-date picker without a native date picker: quick chips plus a ±1 day stepper, limited
 * to today … +1 year like the backend. Remount (via `key`) to reset the selection.
 */
export function DueDateDialog(props: DueDateDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <DueDateBody {...props} /> : null}
    </Dialog>
  );
}

function DueDateBody({
  onOpenChange,
  mode,
  title,
  description,
  currentDue,
  confirmLabel,
  onConfirm,
}: DueDateDialogProps) {
  const now = useMemo(() => new Date(), []);
  const chips = useMemo(
    () => (mode === 'accept' ? acceptChips(now) : extendChips(currentDue ?? null, now)),
    [mode, currentDue, now]
  );
  const [date, setDate] = useState<Date>(() =>
    mode === 'accept'
      ? defaultDueDate(now)
      : (chips[0]?.date ?? clampDueDate(currentDue?.toDate() ?? addDays(now, 7), now))
  );
  const [busy, setBusy] = useState(false);
  const today = startOfDay(now);
  const atMin = sameDay(date, today) || date < today;
  const atMax = sameDay(date, shiftDueDate(today, 400, now));

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(date);
      onOpenChange(false);
    } catch {
      // The caller already showed an error toast; keep the dialog open.
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContent className="gap-5">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>

      <View className="flex-row flex-wrap gap-2">
        {chips.map((c) => {
          const selected = sameDay(c.date, date);
          return (
            <Pressable
              key={c.key}
              onPress={() => setDate(c.date)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={cn(
                'rounded-full border px-3.5 py-1.5',
                selected
                  ? 'border-primary bg-primary'
                  : 'border-border bg-background active:bg-accent dark:bg-input/30'
              )}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  selected ? 'text-primary-foreground' : 'text-foreground'
                )}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onPress={() => setDate((d) => shiftDueDate(d, -1, now))}
          disabled={atMin || busy}
          accessibilityLabel="One day earlier"
        >
          <Icon as={Minus} size={16} />
        </Button>
        <View className="flex-1 items-center gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <Icon as={CalendarDays} size={14} className="text-muted-foreground" />
            <Text className="text-xs text-muted-foreground">
              {WEEKDAYS[date.getDay()]} · {relativeDueHint(date, now)}
            </Text>
          </View>
          <Text className="text-lg font-semibold">{formatLongDate(date)}</Text>
        </View>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onPress={() => setDate((d) => shiftDueDate(d, 1, now))}
          disabled={atMax || busy}
          accessibilityLabel="One day later"
        >
          <Icon as={Plus} size={16} />
        </Button>
      </View>

      <DialogFooter>
        <Button variant="outline" onPress={() => onOpenChange(false)} disabled={busy}>
          <Text>Cancel</Text>
        </Button>
        <Button onPress={confirm} disabled={busy}>
          {busy ? <ActivityIndicator size="small" /> : null}
          <Text>{confirmLabel}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
