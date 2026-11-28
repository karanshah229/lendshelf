import { BookOpen, Search } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useMyProfile, useUid } from '@/hooks/use-auth';
import { useMyReadings } from '@/hooks/use-readings';
import { toastError } from '@/lib/toast';
import { MAX_READING, type Reading, type WithId } from '@/types/model';

import { goFindABook } from '@/features/home/search-focus';
import { setShareReading } from '@/features/reading/mutations';
import {
  finishedLabel,
  readingSinceLabel,
  sharesReading,
  splitReadings,
} from '@/features/reading/reading';
import { BookRowSkeletons, SectionHeader } from '@/features/shared/ui';

function ReadingList({
  readings,
  meta,
}: {
  readings: readonly WithId<Reading>[];
  meta: (r: WithId<Reading>) => string;
}) {
  return (
    <View className="gap-1">
      {readings.map((r) => (
        <BookRow
          key={r.id}
          title={r.title}
          authors={r.authors}
          coverUrl={r.coverUrl}
          href={{ pathname: '/book/[workId]', params: { workId: r.workId } }}
          meta={meta(r)}
        />
      ))}
    </View>
  );
}

/** Your reading: books you're reading now, the ones you've finished, and who can see them. */
export default function ReadingScreen() {
  const uid = useUid();
  const { profile } = useMyProfile();
  const { readings, loading } = useMyReadings();
  const [saving, setSaving] = useState(false);
  const { now, read } = splitReadings(readings);
  const shared = sharesReading(profile);

  const toggleShare = async (on: boolean) => {
    setSaving(true);
    try {
      await setShareReading(uid, on);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen header={<ScreenHeader title="Reading" />}>
      <View className="w-full max-w-2xl gap-8 self-center">
        {loading ? (
          <BookRowSkeletons count={3} />
        ) : !readings.length ? (
          <EmptyState
            icon={BookOpen}
            title="Nothing here yet"
            description="Open any book and tap “I’m reading this”. When you finish it, it moves to your Read list."
          >
            <Button onPress={goFindABook}>
              <Icon as={Search} size={16} className="text-primary-foreground" />
              <Text>Find a book</Text>
            </Button>
          </EmptyState>
        ) : (
          <>
            <View>
              <SectionHeader
                title="Reading now"
                description={
                  now.length ? `${now.length} of ${MAX_READING}` : 'Not reading anything right now'
                }
              />
              {now.length ? (
                <ReadingList readings={now} meta={(r) => readingSinceLabel(r)} />
              ) : null}
            </View>
            {read.length ? (
              <View>
                <SectionHeader
                  title="Read"
                  description={`${read.length} ${read.length === 1 ? 'book' : 'books'}`}
                />
                <ReadingList readings={read} meta={(r) => finishedLabel(r)} />
              </View>
            ) : null}
          </>
        )}

        <Card className="flex-row items-center gap-3 px-4 py-4">
          <View className="flex-1 gap-0.5">
            <Text className="font-semibold">Show my reading to contacts</Text>
            <Text className="text-sm text-muted-foreground">
              {shared
                ? 'People who have your number saved see what you’re reading and have read.'
                : 'Only you can see what you’re reading and have read.'}
            </Text>
          </View>
          {saving ? (
            <ActivityIndicator size="small" />
          ) : (
            <Switch
              checked={shared}
              onCheckedChange={(on) => void toggleShare(on)}
              accessibilityLabel="Show my reading to contacts"
            />
          )}
        </Card>
      </View>
    </Screen>
  );
}
