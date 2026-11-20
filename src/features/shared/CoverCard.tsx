import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { StatusBadge } from '@/components/status-badge';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { itemStatus, type Item, type WithId } from '@/types/model';

/** Cover-first card for a copy (carousels and grids). Opens the copy page. */
export function CoverCard({
  item,
  subtitle,
  requestedByMe,
  className,
}: {
  item: WithId<Item>;
  subtitle?: string;
  requestedByMe?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/copy/[itemId]', params: { itemId: item.id } })}
      className={cn('gap-1.5 active:opacity-80', className)}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${item.title}, ${subtitle}` : item.title}
    >
      <BookCover uri={item.coverUrl} title={item.title} className="w-full" />
      <View className="gap-0.5">
        <Text className="text-sm font-medium leading-4" numberOfLines={2}>
          {item.title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="flex-row">
        <StatusBadge status={itemStatus(item, { requestedByMe })} compact />
      </View>
    </Pressable>
  );
}

/** Three-column grid of CoverCards. */
export function CoverGrid({
  items,
  subtitleOf,
  requestedItemIds,
}: {
  items: WithId<Item>[];
  subtitleOf?: (item: WithId<Item>) => string | undefined;
  requestedItemIds?: ReadonlySet<string>;
}) {
  return (
    <View className="-mx-1.5 flex-row flex-wrap">
      {items.map((item) => (
        <View key={item.id} className="mb-4 w-1/3 px-1.5">
          <CoverCard
            item={item}
            subtitle={subtitleOf?.(item)}
            requestedByMe={requestedItemIds?.has(item.id)}
          />
        </View>
      ))}
    </View>
  );
}
