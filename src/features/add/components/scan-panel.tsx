import {
  BookX,
  CircleAlert,
  CornerDownLeft,
  PenLine,
  RotateCw,
  ScanBarcode,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatIsbn, normaliseIsbn } from '@/features/add/isbn';
import { summariseScanQueue, type ScanEntry, type ScanQueueState } from '@/features/add/scan-queue';
import { cn } from '@/lib/utils';

import { BarcodeCamera, CAMERA_SCANNING, type ScanOutcome } from './barcode-camera';

export interface ScanPanelProps {
  queue: ScanQueueState;
  ownedWorkIds: ReadonlySet<string>;
  /** Camera runs only while the panel is visible. */
  active: boolean;
  onBarcode(data: string): ScanOutcome;
  onIsbn(isbn: string): ScanOutcome;
  onRetry(isbn: string): void;
  onRemove(isbn: string): void;
  onClear(): void;
  onManual(isbn: string): void;
  onReview(): void;
}

/** Continuous scanning with a review queue; "Review" moves the ready books to the confirm step. */
export function ScanPanel({
  queue,
  ownedWorkIds,
  active,
  onBarcode,
  onIsbn,
  onRetry,
  onRemove,
  onClear,
  onManual,
  onReview,
}: ScanPanelProps) {
  const insets = useSafeAreaInsets();
  const summary = summariseScanQueue(queue);

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-6"
        keyboardShouldPersistTaps="handled"
        // Dragging the list puts the keyboard away, so the queue isn't stuck in a sliver while
        // typing an ISBN (QA-ANDROID polish).
        keyboardDismissMode="on-drag"
      >
        <BarcodeCamera active={active} onBarcode={onBarcode} />
        <IsbnEntry onSubmit={onIsbn} prominent={!CAMERA_SCANNING} />

        {queue.entries.length ? (
          <View className="gap-1">
            <View className="flex-row items-center justify-between pb-1">
              <Text className="text-sm font-semibold">
                Scanned · {summary.total}
                {summary.resolving ? (
                  <Text className="text-sm font-normal text-muted-foreground">
                    {'  '}looking up {summary.resolving}…
                  </Text>
                ) : null}
              </Text>
              <Button variant="ghost" size="sm" onPress={onClear}>
                <Text className="text-muted-foreground">Clear</Text>
              </Button>
            </View>
            {queue.entries.map((e) => (
              <QueueRow
                key={e.isbn}
                entry={e}
                owned={!!e.candidate?.workId && ownedWorkIds.has(e.candidate.workId)}
                onRetry={() => onRetry(e.isbn)}
                onRemove={() => onRemove(e.isbn)}
                onManual={() => onManual(e.isbn)}
              />
            ))}
          </View>
        ) : (
          <View className="items-center gap-2 py-6">
            <Icon as={ScanBarcode} size={22} className="text-muted-foreground" />
            <Text className="max-w-xs text-center text-sm leading-5 text-muted-foreground">
              {CAMERA_SCANNING
                ? 'Scan one book after another. They collect here so you can add them all at once.'
                : 'Each ISBN you enter collects here so you can add them all at once.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {queue.entries.length ? (
        <View
          className="border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Button size="lg" disabled={!summary.ready} onPress={onReview}>
            <Text>
              {summary.ready
                ? `Review ${summary.ready} ${summary.ready === 1 ? 'book' : 'books'}`
                : summary.resolving
                  ? 'Looking up…'
                  : 'Nothing to add yet'}
            </Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function IsbnEntry({
  onSubmit,
  prominent,
}: {
  onSubmit(isbn: string): ScanOutcome;
  prominent: boolean;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const isbn = normaliseIsbn(value);
    if (!isbn) {
      setError(
        value.trim() ? 'That isn’t a valid ISBN. Check the digits.' : 'Type the 10 or 13 digits.'
      );
      return;
    }
    const outcome = onSubmit(isbn);
    if (outcome === 'duplicate') setError('Already in the list below.');
    else {
      setError(null);
      setValue('');
    }
  };

  return (
    <View className="gap-1.5">
      {prominent ? <Text className="text-sm font-medium">ISBN</Text> : null}
      <View className="flex-row gap-2">
        <Input
          value={value}
          onChangeText={(t) => {
            setValue(t);
            setError(null);
          }}
          onSubmitEditing={submit}
          placeholder={prominent ? 'e.g. 978 0141 439518' : 'Or type an ISBN'}
          keyboardType="number-pad"
          returnKeyType="done"
          autoCorrect={false}
          className={cn('flex-1', error && 'border-destructive')}
          accessibilityLabel="ISBN"
        />
        <Button variant={prominent ? 'default' : 'outline'} onPress={submit}>
          <Icon
            as={CornerDownLeft}
            size={16}
            className={prominent ? 'text-primary-foreground' : undefined}
          />
          <Text>Add</Text>
        </Button>
      </View>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
    </View>
  );
}

function QueueRow({
  entry,
  owned,
  onRetry,
  onRemove,
  onManual,
}: {
  entry: ScanEntry;
  owned: boolean;
  onRetry(): void;
  onRemove(): void;
  onManual(): void;
}) {
  const c = entry.candidate;
  return (
    <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-2">
      {entry.status === 'ready' && c ? (
        <BookCover uri={c.coverUrl} title={c.title} size="xs" />
      ) : (
        <View className="aspect-[2/3] w-10 items-center justify-center rounded-md bg-muted">
          {entry.status === 'resolving' ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon
              as={entry.status === 'notFound' ? BookX : CircleAlert}
              size={16}
              className={entry.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}
            />
          )}
        </View>
      )}

      <View className="flex-1 gap-0.5">
        {entry.status === 'ready' && c ? (
          <>
            <Text className="text-sm font-semibold leading-4" numberOfLines={2}>
              {c.title}
            </Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {c.authors.join(', ') || formatIsbn(entry.isbn)}
            </Text>
            {owned ? (
              <Text className="text-xs font-medium text-amber-700 dark:text-amber-400">
                You already have a copy
              </Text>
            ) : null}
          </>
        ) : entry.status === 'resolving' ? (
          <>
            <Text className="text-sm font-medium">Looking up…</Text>
            <Text className="text-xs text-muted-foreground">{formatIsbn(entry.isbn)}</Text>
          </>
        ) : entry.status === 'notFound' ? (
          <>
            <Text className="text-sm font-medium">Not found in the catalogue</Text>
            <Text className="text-xs text-muted-foreground">{formatIsbn(entry.isbn)}</Text>
          </>
        ) : (
          <>
            <Text className="text-sm font-medium">Couldn’t look this up</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={2}>
              {entry.error ?? formatIsbn(entry.isbn)}
            </Text>
          </>
        )}
      </View>

      {entry.status === 'notFound' ? (
        <Button size="sm" variant="outline" onPress={onManual}>
          <Icon as={PenLine} size={14} />
          <Text>Type it in</Text>
        </Button>
      ) : entry.status === 'error' ? (
        <Button size="sm" variant="outline" onPress={onRetry}>
          <Icon as={RotateCw} size={14} />
          <Text>Retry</Text>
        </Button>
      ) : null}
      <Pressable
        onPress={onRemove}
        className="size-8 items-center justify-center rounded-full active:bg-accent"
        // 32 dp circle, 48 dp touch target (F8).
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Remove from list"
      >
        <Icon as={X} size={16} className="text-muted-foreground" />
      </Pressable>
    </View>
  );
}
