import { router } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { BookRow } from '@/components/book-row';
import { Text } from '@/components/ui/text';
import type { OwnerStatus } from '@/features/library/filter';
import { cn } from '@/lib/utils';
import type { Item, WithId } from '@/types/model';

import { OwnerStatusBadge, OwnerStatusLine } from './owner-status-badge';

const openCopy = (itemId: string) =>
  router.push({ pathname: '/copy/[itemId]', params: { itemId } });

/** Grid tile: cover, title, compact status. */
export function CopyGridCard({
  item,
  status,
  className,
}: {
  item: WithId<Item>;
  status: OwnerStatus;
  className?: string;
}) {
  return (
    <Pressable
      onPress={() => openCopy(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${status.label}`}
      className={cn(
        'gap-1.5 rounded-lg p-1 active:opacity-80',
        Platform.select({ web: 'hover:bg-accent/60' }),
        className
      )}
    >
      <View>
        <BookCover uri={item.coverUrl} title={item.title} className="w-full" />
        {/* Hidden copies are dimmed so they stand apart at a glance. */}
        {status.kind === 'hidden' ? (
          <View className="absolute inset-0 rounded-md bg-background/40" />
        ) : null}
      </View>
      <View className="gap-0.5 px-0.5">
        <Text numberOfLines={2} className="text-[13px] font-semibold leading-4">
          {item.title}
        </Text>
        <OwnerStatusLine status={status} />
      </View>
    </Pressable>
  );
}

/** List row: cover, title, authors, collection name, status badge. */
export function CopyListRow({
  item,
  status,
  shelfName,
}: {
  item: WithId<Item>;
  status: OwnerStatus;
  shelfName?: string;
}) {
  return (
    <BookRow
      title={item.title}
      authors={item.authors}
      coverUrl={item.coverUrl}
      onPress={() => openCopy(item.id)}
      meta={shelfName}
      badge={<OwnerStatusBadge status={status} />}
    />
  );
}
