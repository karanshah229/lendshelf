/** Home feed section: what people in my circle are reading now (hidden when nobody is). */
import { useMemo } from 'react';
import { View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { useCircleReadings } from '@/hooks/use-readings';

import { circleReading } from '@/features/reading/reading';
import { joinNames, shortNames } from '@/features/shared/people';
import { SectionHeader } from '@/features/shared/ui';

const HOME_MAX_READS = 4;

export function CircleReading({ uid, nameOf }: { uid: string; nameOf: (uid: string) => string }) {
  const { readings } = useCircleReadings();
  const reads = useMemo(() => circleReading(readings, uid, HOME_MAX_READS), [readings, uid]);
  if (!reads.length) return null;
  return (
    <View>
      <SectionHeader title="Your circle is reading" />
      <View className="gap-1">
        {reads.map((r) => (
          <BookRow
            key={r.workId}
            title={r.title}
            authors={r.authors}
            coverUrl={r.coverUrl}
            href={{ pathname: '/book/[workId]', params: { workId: r.workId } }}
            meta={`${joinNames(shortNames(r.readers.map(nameOf)))} ${r.readers.length === 1 ? 'is' : 'are'} reading it`}
          />
        ))}
      </View>
    </View>
  );
}
