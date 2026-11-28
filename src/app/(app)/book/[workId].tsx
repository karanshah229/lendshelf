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

import { circleCopiesForBook } from '@/features/book/circle-copies';
import { CircleCopiesList, NoCopiesCard } from '@/features/book/CircleCopiesList';
import { cleanDescription } from '@/features/book/description';
import { AskDialog, type AskTarget } from '@/features/copy/AskDialog';
import { ReadingPanel } from '@/features/reading/ReadingPanel';
import { ReviewList, useRefreshReviewsOnFocus } from '@/features/reviews/ReviewList';
import { Stars } from '@/features/reviews/Stars';
import {
  useBorrowedItemIds,
  useCircleItems,
  useNameOf,
  useRequestedItemIds,
} from '@/features/shared/hooks';
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
        numberOfLines={expanded ? undefined : 3}
        onTextLayout={(e) => {
          if (!expanded && e.nativeEvent.lines.length >= 3) setLong(true);
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
  const borrowedItemIds = useBorrowedItemIds();
  const nameOf = useNameOf();
  const [askTarget, setAskTarget] = useState<AskTarget | null>(null);
  const [savingWish, setSavingWish] = useState(false);

  const { mine, others } = useMemo(
    () =>
      circleCopiesForBook(workId ?? '', work, items, {
        uid,
        requestedItemIds,
        borrowedItemIds,
        nameOf,
      }),
    [workId, work, items, uid, requestedItemIds, borrowedItemIds, nameOf]
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
  const noCopies = !copiesLoading && !mine.length && !others.length;
  // Hidden when I own a copy (D4); with no copies at all the card below has the button.
  const showWishlistToggle = !mine.length && !(noCopies && !wishlisted);
  // Only the creator can attach copies to a custom book (SPEC §1).
  const canAddCopy = !!work && (!work.isCustom || work.createdBy === uid);

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
          {/* Compact header (D4): cover on the left, details on the right. */}
          <View className="flex-row gap-4 pt-1">
            <BookCover uri={work.coverUrl} title={work.title} size="md" />
            <View className="flex-1 justify-center gap-1">
              <Text className="text-xl font-bold leading-6 tracking-tight" role="heading">
                {work.title}
              </Text>
              {work.authors.length ? (
                <Text className="text-sm text-muted-foreground">{work.authors.join(', ')}</Text>
              ) : null}
              {work.firstPublishYear ? (
                <Text className="text-xs text-muted-foreground">
                  First published {work.firstPublishYear}
                </Text>
              ) : null}
              {reviews.average !== null ? (
                <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
                  <Stars value={reviews.average} size={14} />
                  <Text className="text-xs font-medium">{reviews.average.toFixed(1)}</Text>
                  <Text className="text-xs text-muted-foreground">
                    · {reviews.count} {reviews.count === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Who has it, directly under the header (D4, C9). */}
          <View>
            <SectionHeader
              title="Who has it"
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
                    ownerId: c.item.ownerId,
                  })
                }
              />
            ) : (
              <NoCopiesCard
                wishlisted={wishlisted}
                onAddToWishlist={toggleWishlist}
                saving={savingWish}
              />
            )}
          </View>

          {showWishlistToggle || canAddCopy ? (
            <View className="-mt-4 flex-row gap-2">
              {showWishlistToggle ? (
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
              ) : null}
              {canAddCopy ? (
                <Button variant="outline" className="flex-1" onPress={addCopy}>
                  <Icon as={BookPlus} size={16} />
                  <Text>{mine.length ? 'Add another copy' : 'I own this'}</Text>
                </Button>
              ) : null}
            </View>
          ) : null}

          <ReadingPanel uid={uid} workId={work.id} work={work} nameOf={nameOf} />

          {description ? (
            <View>
              <SectionHeader title="About" />
              <View className="px-1">
                <Description text={description} />
              </View>
            </View>
          ) : null}

          <ReviewList workId={work.id} reviews={reviews} />
        </View>
      )}
      <AskDialog target={askTarget} onOpenChange={(open) => !open && setAskTarget(null)} />
    </Screen>
  );
}
