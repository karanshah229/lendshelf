import { router } from 'expo-router';
import { BellRing, Heart, Search, X } from 'lucide-react-native';
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
import { Text } from '@/components/ui/text';
import { useUid } from '@/hooks/use-auth';
import { useWatches } from '@/hooks/use-watches';
import { useWork } from '@/hooks/use-work';
import { toast, toastError } from '@/lib/toast';
import { itemStatus, type Watch, type WithId } from '@/types/model';

import { circleCopiesForBook, summarizeCircleCopies } from '@/features/book/circle-copies';
import { useCircleItems, useNameOf, useRequestedItemIds } from '@/features/shared/hooks';
import { removeWatch, setWishlisted } from '@/features/shared/mutations';
import { BookRowSkeletons, SectionHeader } from '@/features/shared/ui';
import { wishlistAvailability, type Availability } from '@/features/wishlist/availability';
import { AvailabilityLine } from '@/features/wishlist/AvailabilityLine';

function RemoveButton({ label, onPress }: { label: string; onPress(): Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      disabled={busy}
      accessibilityLabel={label}
      onPress={async () => {
        setBusy(true);
        try {
          await onPress();
        } catch (e) {
          toastError(e);
          setBusy(false);
        }
      }}
    >
      <Icon as={X} size={16} className="text-muted-foreground" />
    </Button>
  );
}

function WishlistRow({
  watch,
  availability,
  onRemove,
}: {
  watch: WithId<Watch>;
  availability: Availability;
  onRemove(): Promise<void>;
}) {
  const { work } = useWork(watch.workId);
  return (
    <View className="flex-row items-center gap-1 pr-2">
      <Pressable
        onPress={() =>
          router.push({ pathname: '/book/[workId]', params: { workId: watch.workId } })
        }
        className="flex-1 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
        accessibilityRole="button"
      >
        <BookCover uri={work?.coverUrl} title={watch.title} size="sm" />
        <View className="flex-1 gap-1">
          <Text className="font-semibold leading-5" numberOfLines={2}>
            {work?.title ?? watch.title}
          </Text>
          {work?.authors.length ? (
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {work.authors.join(', ')}
            </Text>
          ) : null}
          <AvailabilityLine availability={availability} />
        </View>
      </Pressable>
      <RemoveButton label={`Remove ${watch.title} from wishlist`} onPress={onRemove} />
    </View>
  );
}

/** Wishlist (SPEC §6): Books I'll be notified about, and copies I'm waiting to come back. */
export default function WishlistScreen() {
  const uid = useUid();
  const { wishlist, back, loading } = useWatches();
  const { items, loading: itemsLoading } = useCircleItems();
  const requestedItemIds = useRequestedItemIds();
  const nameOf = useNameOf();

  const rows = useMemo(
    () =>
      wishlist
        .map((watch) => ({
          watch,
          availability: wishlistAvailability(
            summarizeCircleCopies(
              circleCopiesForBook(watch.workId, null, items, { uid, requestedItemIds, nameOf })
            ),
            nameOf
          ),
        }))
        .sort((a, b) => a.availability.rank - b.availability.rank),
    [wishlist, items, uid, requestedItemIds, nameOf]
  );
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const removeFromWishlist = async (watch: WithId<Watch>) => {
    await setWishlisted(uid, { workId: watch.workId, title: watch.title }, false);
    // No undo in a timed toast (UX §F3, §F8): the row leaving the list is the feedback, and the
    // Book page's Wishlist toggle adds it back.
    toast.success('Removed from your wishlist');
  };

  const empty = !loading && !wishlist.length && !back.length;

  return (
    <Screen
      header={
        <ScreenHeader
          title="Wishlist"
          subtitle="We’ll tell you when someone in your circle has one"
        />
      }
    >
      {loading ? (
        <BookRowSkeletons count={3} />
      ) : empty ? (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Add books you’d like to read. When someone you know adds one, we’ll let you know."
        >
          <Button onPress={() => router.navigate('/')}>
            <Icon as={Search} size={16} className="text-primary-foreground" />
            <Text>Find books</Text>
          </Button>
        </EmptyState>
      ) : (
        <View className="w-full max-w-2xl gap-8 self-center">
          {rows.length ? (
            <View>
              <SectionHeader
                title="Books you want"
                description={
                  itemsLoading
                    ? 'Checking your circle…'
                    : `${rows.filter((r) => r.availability.tone === 'available').length} available in your circle now`
                }
              />
              <Card className="gap-0 py-0">
                {rows.map(({ watch, availability }, i) => (
                  <View key={watch.id} className={i > 0 ? 'border-t border-border' : undefined}>
                    <WishlistRow
                      watch={watch}
                      availability={availability}
                      onRemove={() => removeFromWishlist(watch)}
                    />
                  </View>
                ))}
              </Card>
            </View>
          ) : null}

          {back.length ? (
            <View>
              <SectionHeader
                title="Waiting for it to come back"
                description="You’ll get a notification when the owner marks it returned"
              />
              <Card className="gap-0 py-0">
                {back.map((watch, i) => {
                  const item = itemsById.get(watch.targetId);
                  return (
                    <View
                      key={watch.id}
                      className={
                        i > 0
                          ? 'flex-row items-center border-t border-border pr-2'
                          : 'flex-row items-center pr-2'
                      }
                    >
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/copy/[itemId]',
                            params: { itemId: watch.targetId },
                          })
                        }
                        className="flex-1 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
                        accessibilityRole="button"
                      >
                        <View className="size-10 items-center justify-center rounded-full bg-muted">
                          <Icon as={BellRing} size={18} className="text-muted-foreground" />
                        </View>
                        <View className="flex-1 gap-1">
                          <Text className="font-medium" numberOfLines={1}>
                            {watch.title}
                          </Text>
                          {item ? (
                            <View className="flex-row flex-wrap items-center gap-1.5">
                              <Text className="text-xs text-muted-foreground">
                                {nameOf(item.ownerId)}’s copy
                              </Text>
                              <StatusBadge status={itemStatus(item)} />
                            </View>
                          ) : (
                            <Text className="text-xs text-muted-foreground">
                              {itemsLoading ? 'Checking…' : 'No longer shared with you'}
                            </Text>
                          )}
                        </View>
                      </Pressable>
                      <RemoveButton
                        label={`Stop waiting for ${watch.title}`}
                        onPress={async () => {
                          await removeWatch(watch.id);
                          toast.success('You won’t be notified');
                        }}
                      />
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
