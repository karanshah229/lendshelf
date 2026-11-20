import { useLocalSearchParams } from 'expo-router';
import { BookOpen, Star } from 'lucide-react-native';
import { View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useVisibleReviews } from '@/hooks/use-reviews';
import { useWork } from '@/hooks/use-work';

/** Book page (SPEC §6). Stub: header only; copies, reviews and actions come next. */
export default function BookScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const { work, loading } = useWork(workId);
  const { average, count } = useVisibleReviews(workId);

  return (
    <Screen header={<ScreenHeader title="Book" />}>
      {loading ? (
        <View className="items-center gap-3">
          <Skeleton className="h-52 w-36 rounded-md" />
          <Skeleton className="h-5 w-48" />
        </View>
      ) : work ? (
        <View className="items-center gap-3">
          <BookCover uri={work.coverUrl} title={work.title} size="lg" />
          <Text className="text-center text-2xl font-bold tracking-tight">{work.title}</Text>
          <Text className="text-center text-muted-foreground">
            {work.authors.join(', ')}
            {work.firstPublishYear ? ` · ${work.firstPublishYear}` : ''}
          </Text>
          {average !== null ? (
            <View className="flex-row items-center gap-1">
              <Icon as={Star} size={14} className="text-amber-500" fill="currentColor" />
              <Text className="text-sm">
                {average} · {count} {count === 1 ? 'review' : 'reviews'}
              </Text>
            </View>
          ) : null}
          <EmptyState
            title="More coming soon"
            description="Copies in your circle, reviews and the wishlist toggle."
          />
        </View>
      ) : (
        <EmptyState icon={BookOpen} title="Book not found" />
      )}
    </Screen>
  );
}
