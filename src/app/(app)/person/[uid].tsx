import { router, useLocalSearchParams } from 'expo-router';
import { Library, MessageCircle, Search, UserRound, UserX, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useProfile, useUid } from '@/hooks/use-auth';
import { useOwnerItems } from '@/hooks/use-items';
import { useDisplayName, useLinkMap, useLinks } from '@/hooks/use-links';
import { usePublicShelves } from '@/hooks/use-shelves';
import { formatPhone } from '@/lib/phone';
import { searchCopies } from '@/lib/search';
import { greeting } from '@/lib/whatsapp';

import { groupItemsByShelf } from '@/features/person/group-by-shelf';
import { PersonReading } from '@/features/reading/PersonReading';
import { CoverGrid } from '@/features/shared/CoverCard';
import { useBorrowedItemIds, useRequestedItemIds } from '@/features/shared/hooks';
import { PersonAvatar, SectionHeader } from '@/features/shared/ui';
import { shortName } from '@/features/shared/people';
import { openWhatsApp } from '@/features/shared/whatsapp-open';

type Filter = 'all' | 'available';

/** A contact's public collections and shared copies (SPEC §6). */
export default function PersonScreen() {
  const { uid: personId } = useLocalSearchParams<{ uid: string }>();
  const me = useUid();
  const { loading: linksLoading } = useLinks();
  const link = useLinkMap().get(personId ?? '');
  const name = useDisplayName(personId);
  const { profile } = useProfile(personId);
  const canSee = !!link;
  const { shelves, loading: shelvesLoading } = usePublicShelves(canSee ? personId : null);
  const { items, loading: itemsLoading } = useOwnerItems(canSee ? personId : null);
  const requestedItemIds = useRequestedItemIds();
  const borrowedItemIds = useBorrowedItemIds();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const availableCount = useMemo(
    () => items.filter((i) => i.loanState === 'available' && i.visibility === 'lendable').length,
    [items]
  );
  const groups = useMemo(() => {
    let list = items;
    if (filter === 'available') {
      list = list.filter((i) => i.loanState === 'available' && i.visibility === 'lendable');
    }
    if (query.trim()) {
      const ids = new Set(searchCopies(list, query).flatMap((g) => g.copies.map((c) => c.id)));
      list = list.filter((i) => ids.has(i.id));
    }
    return groupItemsByShelf(shelves, list);
  }, [items, shelves, filter, query]);

  if (personId === me) {
    return (
      <Screen header={<ScreenHeader title="You" />}>
        <EmptyState
          icon={UserRound}
          title="This is you"
          description="Your own books live in the My books tab."
        >
          <Button onPress={() => router.navigate('/my-books')}>
            <Text>Go to My books</Text>
          </Button>
        </EmptyState>
      </Screen>
    );
  }

  const loading = linksLoading || (canSee && (shelvesLoading || itemsLoading));
  const message = () =>
    link &&
    // F6/R21: greet by their own profile first name, never the name saved in my contacts.
    openWhatsApp(
      link.ownerPhone,
      `${greeting(link.profileName ?? profile?.name)} Saw your books on LendShelf.`
    );
  const short = shortName(name) || name;

  return (
    <Screen header={<ScreenHeader title={name} />}>
      <View className="w-full max-w-2xl gap-6 self-center">
        <Card className="items-center gap-3 px-6 py-6">
          <PersonAvatar name={name} size="lg" />
          <View className="items-center gap-0.5">
            <Text className="text-xl font-bold tracking-tight">{name}</Text>
            {link ? (
              <Text className="text-sm text-muted-foreground">{formatPhone(link.ownerPhone)}</Text>
            ) : null}
            {link?.contactName && link.profileName && link.contactName !== link.profileName ? (
              <Text className="text-xs text-muted-foreground">
                On LendShelf as {link.profileName}
              </Text>
            ) : null}
          </View>
          {profile?.pickupNote ? (
            <View className="rounded-lg bg-muted px-3 py-2">
              <Text className="text-center text-sm">
                <Text className="text-sm font-medium">Pickup: </Text>
                {profile.pickupNote}
              </Text>
            </View>
          ) : null}
          {canSee && !loading ? (
            <View className="flex-row gap-6 pt-1">
              <View className="items-center">
                <Text className="text-lg font-semibold">{items.length}</Text>
                <Text className="text-xs text-muted-foreground">
                  {items.length === 1 ? 'book' : 'books'}
                </Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-semibold">{availableCount}</Text>
                <Text className="text-xs text-muted-foreground">to borrow</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-semibold">{shelves.length}</Text>
                <Text className="text-xs text-muted-foreground">
                  {shelves.length === 1 ? 'collection' : 'collections'}
                </Text>
              </View>
            </View>
          ) : null}
          {link ? (
            <Button variant="outline" className="mt-1 w-full" onPress={message}>
              <Icon as={MessageCircle} size={16} />
              <Text>Message on WhatsApp</Text>
            </Button>
          ) : null}
        </Card>

        {canSee && personId ? <PersonReading uid={personId} /> : null}

        {loading ? (
          <View className="-mx-1.5 flex-row flex-wrap">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} className="mb-4 w-1/3 gap-2 px-1.5">
                <Skeleton className="aspect-[2/3] w-full rounded-md" />
                <Skeleton className="h-3 w-3/4" />
              </View>
            ))}
          </View>
        ) : !canSee ? (
          <EmptyState
            icon={UserX}
            title="Not in your contacts"
            description="You can see someone’s books once their number is saved in your phone and your contacts are synced."
          >
            <Button variant="outline" onPress={() => router.push('/contacts')}>
              <Text>Sync contacts</Text>
            </Button>
          </EmptyState>
        ) : !items.length ? (
          <EmptyState
            icon={Library}
            title="No shared books yet"
            description={`${short} hasn’t shared any books with contacts yet.`}
          />
        ) : (
          <View className="gap-4">
            <View className="gap-3">
              {items.length > 8 ? (
                <View className="relative justify-center">
                  <Icon
                    as={Search}
                    size={16}
                    className="absolute left-3 z-10 text-muted-foreground"
                  />
                  <Input
                    value={query}
                    onChangeText={setQuery}
                    placeholder={`Search ${short}’s books`}
                    className="pl-9 pr-10"
                    autoCorrect={false}
                    accessibilityLabel="Search their books"
                  />
                  {query ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0.5 rounded-full"
                      onPress={() => setQuery('')}
                      accessibilityLabel="Clear search"
                    >
                      <Icon as={X} size={14} className="text-muted-foreground" />
                    </Button>
                  ) : null}
                </View>
              ) : null}
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={filter}
                onValueChange={(v) => v && setFilter(v as Filter)}
                className="self-start"
              >
                <ToggleGroupItem value="all" aria-label="All books" isFirst className="px-3">
                  <Text>All</Text>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="available"
                  aria-label="Available to borrow"
                  isLast
                  className="px-3"
                >
                  <Text>Available to borrow</Text>
                </ToggleGroupItem>
              </ToggleGroup>
            </View>

            {groups.length ? (
              groups.map((g) => (
                <View key={g.shelfId}>
                  <SectionHeader
                    title={g.name ?? 'Other books'}
                    action={<Text className="text-xs text-muted-foreground">{g.items.length}</Text>}
                  />
                  <CoverGrid
                    items={g.items}
                    requestedItemIds={requestedItemIds}
                    borrowedItemIds={borrowedItemIds}
                  />
                </View>
              ))
            ) : (
              <EmptyState
                icon={Search}
                title="Nothing matches"
                description={
                  filter === 'available'
                    ? 'Nothing available to borrow right now.'
                    : 'Try a different title or author.'
                }
              />
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}
