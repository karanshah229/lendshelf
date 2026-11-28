/**
 * Book page reading controls: "I'm reading this", then "Finished it" (opens the review screen)
 * or "Stop reading"; a finished book offers "Read it again". Also says which contacts are
 * reading the book now.
 */
import { router } from 'expo-router';
import { BookCheck, BookOpen } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCircleReadings, useMyReadings } from '@/hooks/use-readings';
import { toast, toastError } from '@/lib/toast';
import type { Work } from '@/types/model';

import {
  finishReading,
  removeReading,
  startReading,
  stopReading,
} from '@/features/reading/mutations';
import {
  canStartReading,
  finishedLabel,
  readBeforeLabel,
  readersOf,
  readingSinceLabel,
  splitReadings,
  TOO_MANY_READING,
} from '@/features/reading/reading';
import { joinNames, shortNames } from '@/features/shared/people';

type Busy = 'start' | 'finish' | 'stop' | 'remove' | null;

export function ReadingPanel({
  uid,
  workId,
  work,
  nameOf,
}: {
  uid: string;
  workId: string;
  work: Pick<Work, 'title' | 'authors' | 'coverUrl'>;
  nameOf: (uid: string) => string;
}) {
  const { readings, loading } = useMyReadings();
  const circle = useCircleReadings();
  const [busy, setBusy] = useState<Busy>(null);

  const mine = readings.find((r) => r.workId === workId) ?? null;
  const readingNow = splitReadings(readings).now.length;
  const readers = useMemo(
    () => readersOf(circle.readings, workId, uid),
    [circle.readings, workId, uid]
  );
  const readersLine = readers.length
    ? `${joinNames(shortNames(readers.map(nameOf)))} ${readers.length === 1 ? 'is' : 'are'} reading this`
    : null;

  const run = async (kind: Busy, action: () => Promise<void>, done?: string) => {
    setBusy(kind);
    try {
      await action();
      if (done) toast.success(done);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const start = () => {
    const check = canStartReading(mine, readingNow);
    if (!check.ok) {
      toast.error(TOO_MANY_READING);
      return;
    }
    void run('start', () => startReading(uid, workId, work, mine), 'Added to Reading now');
  };

  const finish = () =>
    void run('finish', async () => {
      await finishReading(uid, workId);
      toast.success('Added to your Read list');
      router.push({ pathname: '/review/[workId]', params: { workId } });
    });

  if (loading) return null;

  const others = readersLine ? (
    <Text className="px-1 text-sm text-muted-foreground">{readersLine}</Text>
  ) : null;

  if (mine?.status === 'reading') {
    return (
      <View className="gap-2">
        <Card className="gap-3 px-4 py-4">
          <View className="flex-row items-center gap-3">
            <View className="size-9 items-center justify-center rounded-full bg-primary/10">
              <Icon as={BookOpen} size={18} className="text-primary" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">You’re reading this</Text>
              <Text className="text-sm text-muted-foreground">
                {readingSinceLabel(mine)}
                {mine.finishedAt ? ` · ${readBeforeLabel(mine)}` : ''}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <Button className="flex-1" onPress={finish} disabled={!!busy}>
              <Icon as={BookCheck} size={16} className="text-primary-foreground" />
              <Text>Finished it</Text>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={!!busy}
              onPress={() =>
                void run(
                  'stop',
                  () => stopReading(uid, mine),
                  mine.finishedAt ? 'Back in your Read list' : 'Removed from Reading now'
                )
              }
            >
              <Text>Stop reading</Text>
            </Button>
          </View>
        </Card>
        {others}
      </View>
    );
  }

  if (mine?.status === 'finished') {
    return (
      <View className="gap-2">
        <Card className="gap-3 px-4 py-4">
          <View className="flex-row items-center gap-3">
            <View className="size-9 items-center justify-center rounded-full bg-muted">
              <Icon as={BookCheck} size={18} className="text-muted-foreground" />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">You’ve read this</Text>
              <Text className="text-sm text-muted-foreground">{finishedLabel(mine)}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={start} disabled={!!busy}>
              <Icon as={BookOpen} size={16} />
              <Text>Read it again</Text>
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={!!busy}
              onPress={() =>
                void run('remove', () => removeReading(uid, workId), 'Removed from your Read list')
              }
            >
              <Text>Remove from Read</Text>
            </Button>
          </View>
        </Card>
        {others}
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Button variant="outline" onPress={start} disabled={!!busy}>
        <Icon as={BookOpen} size={16} />
        <Text>I’m reading this</Text>
      </Button>
      {others}
    </View>
  );
}
