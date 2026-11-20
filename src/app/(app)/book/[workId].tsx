import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, BookPlus, Heart } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useMyProfile, useUid } from '@/hooks/use-auth';
import { useVisibleReviews } from '@/hooks/use-reviews';
import { useWatches } from '@/hooks/use-watches';
import { useWork } from '@/hooks/use-work';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { circleCopiesForWork } from '@/features/book/circle-copies';
import { CircleCopiesList, NoCopiesCard } from '@/features/book/CircleCopiesList';
import { cleanDescription } from '@/features/book/description';
import { AskDialog, type AskTarget } from '@/features/copy/AskDialog';
import { ReviewList, useRefreshReviewsOnFocus } from '@/features/reviews/ReviewList';
import { Stars } from '@/features/reviews/Stars';
import { useCircleItems, useNameOf, useRequestedItemIds } from '@/features/shared/hooks';
import { setWishlisted } from '@/features/shared/mutations';
import { BookHeaderSkeleton, BookRowSkeletons, SectionHeader } from '@/features/shared/ui';

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  return (
    <Pressable
      onPress={() => setExpanded((e) => !e)}
      disabled={!long}
      accessibilityRole={long ? 'button' : undefined}
      accessibilityHint={
        long ? (expanded ? 'Shows less' : 'Shows the full description') : undefined
      }
    >
      <Text
        className="text-sm leading-6 text-foreground/90"
        numberOfLines={expanded ? undefined : 4}
        onTextLayout={(e) => {
          if (!expanded && e.nativeEvent.lines.length >= 4) setLong(true);
        }}
      >
        {text}
      </Text>
      {long ? (
        <Text className="mt-1 text-sm font-medium text-muted-foreground">
          {expanded ? 'Show less' : 'Read more'}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Book page (SPEC §6): the shared record for all copies and editions of a book. */
export default function BookScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const uid = useUid();
  const { profile } = useMyProfile();
  const { work, loading } = useWork(workId);
  const reviews = useVisibleReviews(workId);
  useRefreshReviewsOnFocus(reviews);
  const { isWishlisted } = useWatches();
  const { items, loading: copiesLoading } = useCircleItems();
  const requestedItemIds = useRequestedItemIds();
  const nameOf = useNameOf();
  const [askTarget, setAskTarget] = useState<AskTarget | null>(null);
  const [savingWish, setSavingWish] = useState(false);

  const { mine, others } = useMemo(
    () => circleCopiesForWork(workId ?? '', items, { uid, requestedItemIds, nameOf }),
    [workId, items, uid, requestedItemIds, nameOf]
  );
  const wishlisted = !!workId && isWishlisted(workId);
  const description = useMemo(() => cleanDescription(work?.description), [work?.description]);

  const toggleWishlist = async () => {
    if (!work || !workId) return;
    setSavingWish(true);
    try {
      await setWishlisted(uid, { workId, title: work.title }, !wishlisted);
      toast.success(wishlisted ? 'Removed from your wishlist' : 'Added to your wishlist', {
        description: wishlisted ? undefined : 'We’ll let you know when someone you know adds it.',
      });
    } catch (e) {
      toastError(e);
    } finally {
      setSavingWish(false);
    }
  };

  const addCopy = () => router.push({ pathname: '/add', params: { workId } });

  return (
    <Screen header={<ScreenHeader title={work?.title ?? 'Book'} />}>
      {loading ? (
        <BookHeaderSkeleton />
      ) : !work ? (
        <EmptyState
          icon={BookOpen}
          title="Book not found"
          description="It may have been removed, or it isn’t shared with you."
        >
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go back</Text>
          </Button>
        </EmptyState>
      ) : (
        <View className="w-full max-w-2xl gap-8 self-center">
          <View className="items-center gap-3 pt-2">
            <BookCover uri={work.coverUrl} title={work.title} size="lg" />
            <View className="items-center gap-1 pt-1">
              <Text className="text-center text-2xl font-bold tracking-tight" role="heading">
                {work.title}
              </Text>
              {work.authors.length ? (
                <Text className="text-center text-base text-muted-foreground">
                  {work.authors.join(', ')}
                </Text>
              ) : null}
              {work.firstPublishYear ? (
                <Text className="text-sm text-muted-foreground">
                  First published {work.firstPublishYear}
                </Text>
              ) : null}
            </View>
            {reviews.average !== null ? (
              <View className="flex-row items-center gap-2">
                <Stars value={reviews.average} size={16} />
                <Text className="text-sm font-medium">{reviews.average.toFixed(1)}</Text>
                <Text className="text-sm text-muted-foreground">
                  · {reviews.count} {reviews.count === 1 ? 'review' : 'reviews'}
                </Text>
              </View>
            ) : null}
            <View className="mt-2 w-full flex-row gap-2">
              <Button
                variant={wishlisted ? 'secondary' : 'outline'}
                className="flex-1"
                onPress={toggleWishlist}
                disabled={savingWish}
                accessibilityState={{ selected: wishlisted }}
              >
                <Icon
                  as={Heart}
                  size={16}
                  className={cn(wishlisted && 'text-rose-500')}
                  fill={wishlisted ? 'currentColor' : 'transparent'}
                />
                <Text>{wishlisted ? 'On wishlist' : 'Wishlist'}</Text>
              </Button>
              <Button variant="outline" className="flex-1" onPress={addCopy}>
                <Icon as={BookPlus} size={16} />
                <Text>{mine.length ? 'Add another copy' : 'I own this'}</Text>
              </Button>
            </View>
          </View>

          {description ? (
            <View>
              <SectionHeader title="About" />
              <View className="px-1">
                <Description text={description} />
              </View>
            </View>
          ) : null}

          <View>
            <SectionHeader
              title="Copies in your circle"
              description={
                others.length
                  ? `${others.filter((c) => c.status.kind === 'available').length} of ${others.length} available to borrow`
                  : undefined
              }
            />
            {copiesLoading && !mine.length && !others.length ? (
              <BookRowSkeletons count={2} />
            ) : mine.length || others.length ? (
              <CircleCopiesList
                mine={mine}
                others={others}
                nameOf={nameOf}
                myName={profile?.name ?? 'You'}
                onAsk={(c) =>
                  setAskTarget({
                    itemId: c.item.id,
                    title: c.item.title,
                    coverUrl: c.item.coverUrl,
                    ownerName: nameOf(c.item.ownerId),
                  })
                }
              />
            ) : (
              <NoCopiesCard wishlisted={wishlisted} />
            )}
          </View>

          <ReviewList workId={work.id} reviews={reviews} />
        </View>
      )}
      <AskDialog target={askTarget} onOpenChange={(open) => !open && setAskTarget(null)} />
    </Screen>
  );
}
