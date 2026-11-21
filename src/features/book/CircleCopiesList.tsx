/**
 * "Who has it" on the Book page: my copies first, then contacts' copies ranked by availability,
 * each with the owner, edition, status and a quick "Ask". Copies filed under another catalogue
 * record of the same book say "other edition".
 */
import { router } from 'expo-router';
import { ChevronRight, Heart, Users } from 'lucide-react-native';
import { View } from 'react-native';

import { StatusBadge, statusBadgeText } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { Item, WithId } from '@/types/model';

import type { CircleCopy } from '@/features/book/circle-copies';
import { editionSummary } from '@/features/copy/edition';
import { ListRow, PersonAvatar } from '@/features/shared/ui';

export function CircleCopiesList({
  mine,
  others,
  nameOf,
  myName,
  onAsk,
}: {
  mine: CircleCopy<WithId<Item>>[];
  others: CircleCopy<WithId<Item>>[];
  nameOf(ownerId: string): string;
  myName: string;
  onAsk(copy: CircleCopy<WithId<Item>>): void;
}) {
  const all = [...mine, ...others];
  if (!all.length) return null;

  return (
    <Card className="gap-0 py-0">
      {all.map((c, i) => {
        const name = c.isMine ? 'You' : nameOf(c.item.ownerId);
        const edition = [c.otherEdition ? 'Other edition' : null, editionSummary(c.item)]
          .filter(Boolean)
          .join(' · ');
        const canAsk = !c.isMine && c.status.kind === 'available';
        return (
          <View key={c.item.id} className={i > 0 ? 'border-t border-border' : undefined}>
            <ListRow
              onPress={() =>
                router.push({ pathname: '/copy/[itemId]', params: { itemId: c.item.id } })
              }
              // Status and edition in words, not only the badge colour (F8).
              accessibilityLabel={[
                c.isMine ? 'Your copy' : `${name}’s copy`,
                statusBadgeText(c.status),
                edition,
              ]
                .filter(Boolean)
                .join(', ')}
              leading={<PersonAvatar name={c.isMine ? myName : name} size="md" />}
              title={
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {c.isMine ? 'Your copy' : name}
                </Text>
              }
              subtitle={
                <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
                  <StatusBadge status={c.status} />
                  {edition ? (
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {edition}
                    </Text>
                  ) : null}
                </View>
              }
              trailing={
                canAsk ? null : (
                  <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
                )
              }
              action={
                canAsk ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => onAsk(c)}
                    hitSlop={8}
                    accessibilityLabel={`Ask ${name} to borrow it`}
                  >
                    <Text>Ask</Text>
                  </Button>
                ) : null
              }
            />
          </View>
        );
      })}
    </Card>
  );
}

export function NoCopiesCard({
  wishlisted,
  onAddToWishlist,
  saving,
}: {
  wishlisted: boolean;
  onAddToWishlist?(): void;
  saving?: boolean;
}) {
  return (
    <Card className="items-center gap-3 px-6 py-8">
      <View className="size-11 items-center justify-center rounded-full bg-muted">
        <Icon as={Users} size={20} className="text-muted-foreground" />
      </View>
      <View className="items-center gap-1">
        <Text className="font-semibold">No one in your circle has this yet</Text>
        <Text className="text-center text-sm text-muted-foreground">
          {wishlisted
            ? 'It’s on your wishlist. We’ll tell you when someone you know adds it.'
            : 'We’ll tell you when someone you know adds it.'}
        </Text>
      </View>
      {!wishlisted && onAddToWishlist ? (
        <Button onPress={onAddToWishlist} disabled={saving}>
          <Icon as={Heart} size={16} className="text-primary-foreground" />
          <Text>Add to wishlist</Text>
        </Button>
      ) : null}
    </Card>
  );
}
