/**
 * Discover when not searching: your circle, new from your contacts, popular in your circle.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import type { LinkedOwner } from '@/hooks/use-links';
import type { Item, WithId } from '@/types/model';

import { circleCopiesForWork, summarizeCircleCopies } from '@/features/book/circle-copies';
import { countByOwner, popularInCircle } from '@/features/discover/highlights';
import { CoverCard } from '@/features/shared/CoverCard';
import { PersonAvatar, SectionHeader } from '@/features/shared/ui';

function CircleRow({ links, counts }: { links: LinkedOwner[]; counts: Map<string, number> }) {
  const people = useMemo(
    () => [...links].sort((a, b) => (counts.get(b.ownerId) ?? 0) - (counts.get(a.ownerId) ?? 0)),
    [links, counts]
  );
  return (
    <View>
      <SectionHeader
        title="Your circle"
        description={`${links.length} ${links.length === 1 ? 'person' : 'people'} you know on LendShelf`}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-1"
        className="-mx-4"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {people.map((p) => {
          const n = counts.get(p.ownerId) ?? 0;
          return (
            <Pressable
              key={p.ownerId}
              onPress={() => router.push({ pathname: '/person/[uid]', params: { uid: p.ownerId } })}
              className="w-[72px] items-center gap-1.5 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={`${p.displayName}, ${n} books`}
            >
              <PersonAvatar name={p.displayName} size="lg" />
              <Text className="text-center text-xs font-medium" numberOfLines={1}>
                {p.displayName.split(' ')[0]}
              </Text>
              <Text className="-mt-1 text-[10px] text-muted-foreground">
                {n} {n === 1 ? 'book' : 'books'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function DiscoverHome({
  uid,
  links,
  items,
  networkItems,
  requestedItemIds,
  borrowedItemIds,
  nameOf,
}: {
  uid: string;
  links: LinkedOwner[];
  /** Mine + network. */
  items: WithId<Item>[];
  networkItems: WithId<Item>[];
  requestedItemIds: ReadonlySet<string>;
  /** Copies I'm borrowing right now ("With you"). */
  borrowedItemIds: ReadonlySet<string>;
  nameOf(uid: string): string;
}) {
  const counts = useMemo(() => countByOwner(networkItems), [networkItems]);
  const recent = useMemo(() => networkItems.slice(0, 12), [networkItems]);
  const popular = useMemo(() => popularInCircle(items, { limit: 6 }), [items]);
  const available = useMemo(
    () =>
      networkItems
        .filter(
          (i) =>
            i.loanState === 'available' &&
            i.visibility === 'lendable' &&
            !requestedItemIds.has(i.id)
        )
        .slice(0, 12),
    [networkItems, requestedItemIds]
  );

  return (
    <View className="gap-8">
      <CircleRow links={links} counts={counts} />

      {recent.length ? (
        <View>
          <SectionHeader title="New from your contacts" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-4"
            contentContainerClassName="gap-3"
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {recent.map((item) => (
              <CoverCard
                key={item.id}
                item={item}
                subtitle={nameOf(item.ownerId)}
                requestedByMe={requestedItemIds.has(item.id)}
                borrowedByMe={borrowedItemIds.has(item.id)}
                className="w-28"
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {popular.length ? (
        <View>
          <SectionHeader
            title="Popular in your circle"
            description="Books several people you know own"
          />
          <View className="gap-1">
            {popular.map((p) => {
              const summary = summarizeCircleCopies(
                circleCopiesForWork(p.workId, p.copies, {
                  uid,
                  requestedItemIds,
                  borrowedItemIds,
                })
              );
              return (
                <BookRow
                  key={p.workId}
                  title={p.title}
                  authors={p.authors}
                  coverUrl={p.copies.find((c) => c.coverUrl)?.coverUrl}
                  href={{ pathname: '/book/[workId]', params: { workId: p.workId } }}
                  meta={`${p.ownerCount} people have it${summary.availableCount ? ` · ${summary.availableCount} available` : ''}`}
                  badge={
                    summary.mineCount ? (
                      <Badge variant="outline">
                        <Text>You own it</Text>
                      </Badge>
                    ) : undefined
                  }
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {available.length ? (
        <View>
          <SectionHeader title="Ready to borrow" description="Available now from people you know" />
          <View className="-mx-1.5 flex-row flex-wrap">
            {available.slice(0, 9).map((item) => (
              <View key={item.id} className="mb-4 w-1/3 px-1.5">
                <CoverCard item={item} subtitle={nameOf(item.ownerId)} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
