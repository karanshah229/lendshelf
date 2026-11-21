import { router, useLocalSearchParams } from 'expo-router';
import { Barcode, BookCopy, BookOpen, ChevronRight, Languages, PenLine } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useUid } from '@/hooks/use-auth';
import { useItem } from '@/hooks/use-items';
import { useLinkMap } from '@/hooks/use-links';
import { useMyLoans } from '@/hooks/use-loans';
import { useVisibleReviews } from '@/hooks/use-reviews';
import { useWatches } from '@/hooks/use-watches';
import type { Item, WithId } from '@/types/model';

import { deriveCopyState, openBorrowLoanFor } from '@/features/copy/copy-actions';
import { formatLabel, languageName } from '@/features/copy/edition';
import { EditEditionDialog } from '@/features/copy/EditEditionDialog';
import { DeleteCopySection, OwnerPanel } from '@/features/copy/OwnerPanel';
import { BorrowedLoanFallback, ViewerPanel } from '@/features/copy/ViewerPanel';
import { ReviewList, useRefreshReviewsOnFocus } from '@/features/reviews/ReviewList';
import { Stars } from '@/features/reviews/Stars';
import { useNameOf } from '@/features/shared/hooks';
import { BookHeaderSkeleton, DetailRow, SectionHeader } from '@/features/shared/ui';

function EditionCard({ item, editable }: { item: WithId<Item>; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const format = formatLabel(item.format);
  const language = languageName(item.language);
  return (
    <View>
      <SectionHeader
        title="Edition"
        action={
          editable ? (
            <Button variant="ghost" size="sm" onPress={() => setEditing(true)}>
              <Icon as={PenLine} size={14} />
              <Text>Edit</Text>
            </Button>
          ) : null
        }
      />
      <Card className="gap-0 px-4 py-1">
        <DetailRow icon={BookOpen} label="Format" value={format ?? 'Not set'} />
        <Separator />
        <DetailRow icon={Languages} label="Language" value={language ?? 'Not set'} />
        <Separator />
        <DetailRow icon={Barcode} label="ISBN" value={item.isbn ?? '—'} />
      </Card>
      {editable ? (
        <EditEditionDialog
          key={editing ? 'open' : 'closed'}
          item={item}
          open={editing}
          onOpenChange={setEditing}
        />
      ) : null}
    </View>
  );
}

/** Copy page (SPEC §6): one person's physical copy of a Book. */
export default function CopyScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const uid = useUid();
  const { item, loading: itemLoading } = useItem(itemId);
  const { asBorrower, loading: loansLoading } = useMyLoans();
  // Not readable or gone, but I have it: show it from the loan (DECISIONS #30).
  const fallbackLoan = useMemo(
    () => (item ? null : openBorrowLoanFor(itemId, asBorrower)),
    [item, itemId, asBorrower]
  );
  const loading = itemLoading || (!item && loansLoading);
  const { isWatchingBack } = useWatches();
  const linkMap = useLinkMap();
  const nameOf = useNameOf();
  const reviews = useVisibleReviews(item?.workId);
  useRefreshReviewsOnFocus(reviews);

  const ownerPhone = item ? (linkMap.get(item.ownerId)?.ownerPhone ?? null) : null;
  const state = useMemo(
    () =>
      item
        ? deriveCopyState({
            item,
            uid,
            myBorrowerLoans: asBorrower,
            watchingBack: isWatchingBack(item.id),
            hasOwnerPhone: !!ownerPhone,
          })
        : null,
    [item, uid, asBorrower, isWatchingBack, ownerPhone]
  );
  const isMine = state?.role === 'owner';
  const ownerName = item
    ? isMine
      ? 'You'
      : nameOf(item.ownerId)
    : fallbackLoan
      ? (linkMap.get(fallbackLoan.ownerId)?.displayName ?? fallbackLoan.ownerName)
      : '';

  return (
    <Screen
      header={
        <ScreenHeader title={isMine ? 'Your copy' : ownerName ? `${ownerName}’s copy` : 'Copy'} />
      }
    >
      {loading ? (
        <BookHeaderSkeleton />
      ) : !item && fallbackLoan ? (
        <BorrowedLoanFallback
          loan={fallbackLoan}
          ownerName={ownerName}
          ownerPhone={
            linkMap.get(fallbackLoan.ownerId)?.ownerPhone ?? (fallbackLoan.ownerPhone || null)
          }
        />
      ) : !item || !state ? (
        <EmptyState
          icon={BookCopy}
          title="Copy not found"
          description="It may have been removed, or it isn’t shared with you any more."
        >
          <Button variant="outline" onPress={() => router.back()}>
            <Text>Go back</Text>
          </Button>
        </EmptyState>
      ) : (
        <View className="w-full max-w-2xl gap-6 self-center">
          <Pressable
            onPress={() =>
              router.push({ pathname: '/book/[workId]', params: { workId: item.workId } })
            }
            className="flex-row gap-4 rounded-xl active:opacity-80"
            accessibilityRole="button"
            accessibilityHint="Opens the book page"
          >
            <BookCover uri={item.coverUrl} title={item.title} size="md" />
            <View className="flex-1 justify-center gap-1.5">
              <Text className="text-xl font-bold leading-6 tracking-tight" numberOfLines={3}>
                {item.title}
              </Text>
              {item.authors.length ? (
                <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                  {item.authors.join(', ')}
                </Text>
              ) : null}
              {reviews.average !== null ? (
                <View className="flex-row items-center gap-1.5">
                  <Stars value={reviews.average} size={12} />
                  <Text className="text-xs text-muted-foreground">
                    {reviews.average.toFixed(1)} · {reviews.count}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row flex-wrap items-center gap-2 pt-1">
                <StatusBadge status={state.status} owner={state.role === 'owner'} />
                <View className="flex-row items-center">
                  <Text className="text-xs font-medium text-muted-foreground">Book page</Text>
                  <Icon as={ChevronRight} size={14} className="text-muted-foreground" />
                </View>
              </View>
            </View>
          </Pressable>

          {state.role === 'owner' ? (
            <OwnerPanel item={item} state={state} />
          ) : (
            <ViewerPanel
              item={item}
              state={state}
              uid={uid}
              ownerName={ownerName}
              ownerPhone={ownerPhone}
            />
          )}

          <EditionCard item={item} editable={isMine} />

          <ReviewList workId={item.workId} reviews={reviews} />

          {state.role === 'owner' ? <DeleteCopySection item={item} state={state} /> : null}
        </View>
      )}
    </Screen>
  );
}
