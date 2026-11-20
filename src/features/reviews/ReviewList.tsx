/**
 * Reviews of a Book that I can see (mine + people I have saved), with the on-device average.
 * Used by the Book page and the Copy page.
 */
import { router, useFocusEffect } from 'expo-router';
import { MessageSquareText, PenLine } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useUid } from '@/hooks/use-auth';
import { useLinkMap } from '@/hooks/use-links';
import type { VisibleReviews } from '@/hooks/use-reviews';
import { timeAgo } from '@/lib/dates';
import type { Review, WithId } from '@/types/model';

import { ratingDistribution } from '@/features/reviews/review-logic';
import { Stars } from '@/features/reviews/Stars';
import { PersonAvatar, SectionHeader } from '@/features/shared/ui';

/**
 * Re-reads the reviews whenever the screen regains focus (e.g. after closing the review modal).
 * Skips the first focus, which the hook's own initial read already covers.
 */
export function useRefreshReviewsOnFocus(reviews: Pick<VisibleReviews, 'refresh'>) {
  const first = useRef(true);
  const { refresh } = reviews;
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refresh();
    }, [refresh])
  );
}

function ReviewCard({
  review,
  name,
  isMine,
}: {
  review: WithId<Review>;
  name: string;
  isMine: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [truncatable, setTruncatable] = useState(false);
  return (
    <View className="gap-2 px-4 py-4">
      <View className="flex-row items-center gap-3">
        <PersonAvatar name={name} size="sm" />
        <View className="flex-1">
          <Text className="text-sm font-medium" numberOfLines={1}>
            {isMine ? 'You' : name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Stars value={review.rating} size={12} />
            {review.updatedAt ? (
              <Text className="text-xs text-muted-foreground">{timeAgo(review.updatedAt)}</Text>
            ) : null}
          </View>
        </View>
      </View>
      {review.text ? (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          disabled={!truncatable && !expanded}
          accessibilityRole={truncatable ? 'button' : undefined}
          accessibilityHint={truncatable ? 'Shows the whole review' : undefined}
        >
          <Text
            className="text-sm leading-5 text-foreground/90"
            numberOfLines={expanded ? undefined : 6}
            onTextLayout={(e) => {
              if (!expanded && e.nativeEvent.lines.length >= 6) setTruncatable(true);
            }}
          >
            {review.text}
          </Text>
          {truncatable ? (
            <Text className="mt-1 text-xs font-medium text-muted-foreground">
              {expanded ? 'Show less' : 'Read more'}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

export interface ReviewListProps {
  workId: string;
  reviews: VisibleReviews;
  className?: string;
}

export function ReviewList({ workId, reviews, className }: ReviewListProps) {
  const uid = useUid();
  const linkMap = useLinkMap();
  const { average, count, myReview, loading } = reviews;

  // My review first, then newest.
  const ordered = useMemo(
    () => [
      ...reviews.reviews.filter((r) => r.authorId === uid),
      ...reviews.reviews.filter((r) => r.authorId !== uid),
    ],
    [reviews.reviews, uid]
  );
  const distribution = useMemo(() => ratingDistribution(reviews.reviews), [reviews.reviews]);
  const maxBucket = Math.max(1, ...distribution);

  const openEditor = () => router.push({ pathname: '/review/[workId]', params: { workId } });

  return (
    <View className={className}>
      <SectionHeader
        title="Reviews"
        description="From you and people you have saved"
        action={
          <Button variant="ghost" size="sm" onPress={openEditor}>
            <Icon as={PenLine} size={14} />
            <Text>{myReview ? 'Edit your review' : 'Write a review'}</Text>
          </Button>
        }
      />
      {loading && !count ? (
        <Card className="gap-3 px-4 py-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
      ) : count === 0 ? (
        <Card className="items-center gap-3 px-6 py-8">
          <View className="size-11 items-center justify-center rounded-full bg-muted">
            <Icon as={MessageSquareText} size={20} className="text-muted-foreground" />
          </View>
          <View className="items-center gap-1">
            <Text className="font-semibold">No reviews in your circle yet</Text>
            <Text className="text-center text-sm text-muted-foreground">
              Read it? Tell your friends what you thought.
            </Text>
          </View>
          <Button variant="outline" size="sm" onPress={openEditor}>
            <Text>Write the first review</Text>
          </Button>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <View className="flex-row items-center gap-5 px-4 py-4">
            <View className="items-center gap-1">
              <Text className="text-4xl font-bold tracking-tight">{average?.toFixed(1)}</Text>
              <Stars value={average ?? 0} size={14} />
              <Text className="text-xs text-muted-foreground">
                {count} {count === 1 ? 'review' : 'reviews'}
              </Text>
            </View>
            <View className="flex-1 gap-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = distribution[star - 1] ?? 0;
                return (
                  <View key={star} className="flex-row items-center gap-2">
                    <Text className="w-3 text-xs text-muted-foreground">{star}</Text>
                    <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <View
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${(n / maxBucket) * 100}%` }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
          {ordered.map((r) => (
            <View key={r.id} className="border-t border-border">
              <ReviewCard
                review={r}
                isMine={r.authorId === uid}
                name={linkMap.get(r.authorId)?.displayName ?? r.authorName}
              />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
