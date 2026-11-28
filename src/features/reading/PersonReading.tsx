/**
 * A contact's reading on their person page: what they're reading now and what they've read.
 * Shows nothing when they read nothing or keep their reading to themselves.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useReadingsOf } from '@/hooks/use-readings';

import { finishedLabel, readingSinceLabel, splitReadings } from '@/features/reading/reading';
import { SectionHeader } from '@/features/shared/ui';

const READ_PREVIEW = 3;

export function PersonReading({ uid }: { uid: string }) {
  const { readings, loading, hidden } = useReadingsOf(uid);
  const [showAll, setShowAll] = useState(false);
  if (loading || hidden || !readings.length) return null;
  const { now, read } = splitReadings(readings);
  const shownRead = showAll ? read : read.slice(0, READ_PREVIEW);

  return (
    <View className="gap-6">
      {now.length ? (
        <View>
          <SectionHeader title="Reading now" />
          <View className="gap-1">
            {now.map((r) => (
              <BookRow
                key={r.id}
                title={r.title}
                authors={r.authors}
                coverUrl={r.coverUrl}
                href={{ pathname: '/book/[workId]', params: { workId: r.workId } }}
                meta={readingSinceLabel(r)}
              />
            ))}
          </View>
        </View>
      ) : null}
      {read.length ? (
        <View>
          <SectionHeader
            title="Read"
            description={`${read.length} ${read.length === 1 ? 'book' : 'books'}`}
          />
          <View className="gap-1">
            {shownRead.map((r) => (
              <BookRow
                key={r.id}
                title={r.title}
                authors={r.authors}
                coverUrl={r.coverUrl}
                href={{ pathname: '/book/[workId]', params: { workId: r.workId } }}
                meta={finishedLabel(r)}
              />
            ))}
          </View>
          {read.length > READ_PREVIEW ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onPress={() => setShowAll((s) => !s)}
            >
              <Text>{showAll ? 'Show less' : `Show all ${read.length}`}</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
