import { CalendarDays, CircleAlert, Minus, Plus } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
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
import { announce } from '@/lib/a11y';
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
  /** Side effect to call out before confirming, e.g. "Kabir’s request will be declined…" (E5). */
  warning?: string;
  /** Current due date (change mode). */
  currentDue?: TimestampLike | null;
  confirmLabel: string;
  /** Resolve to close; throw to keep the dialog open. */
  onConfirm(date: Date): Promise<void>;
  /** Extra inputs under the warning, e.g. the pickup-note prompt on accept (E5 step 2). */
  children?: ReactNode;
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
  warning,
  currentDue,
  confirmLabel,
  onConfirm,
  children,
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

  const busyLabel = mode === 'accept' ? 'Lending…' : 'Saving…';

  const confirm = async () => {
    setBusy(true);
    announce(busyLabel);
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

      {warning ? (
        <View
          className="flex-row gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3"
          accessibilityRole="alert"
        >
          <Icon as={CircleAlert} size={16} className="mt-0.5 text-amber-700 dark:text-amber-400" />
          <Text className="flex-1 text-sm leading-5">{warning}</Text>
        </View>
      ) : null}

      {children}

      <View className="flex-row flex-wrap gap-2">
        {chips.map((c) => {
          const selected = sameDay(c.date, date);
          return (
            <Pressable
              key={c.key}
              onPress={() => setDate(c.date)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              // 32 dp chip, 48 dp touch target (F8).
              hitSlop={{ top: 8, bottom: 8 }}
              className={cn(
                'rounded-full border px-3.5 py-1.5',
                selected
                  ? 'border-primary bg-primary active:bg-primary/90 dark:bg-primary'
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
        {/* Read out the new date after each ±1 day step (F8). */}
        <View
          className="flex-1 items-center gap-0.5"
          accessible
          accessibilityLabel={`Due ${formatLongDate(date)}, ${WEEKDAYS[date.getDay()]}, ${relativeDueHint(date, now)}`}
          accessibilityLiveRegion="polite"
        >
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
          <Text>{busy ? busyLabel : confirmLabel}</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
