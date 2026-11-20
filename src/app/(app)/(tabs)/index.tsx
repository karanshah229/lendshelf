import { router } from 'expo-router';
import { BookPlus, Globe, Heart, Search, Users, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useUid } from '@/hooks/use-auth';
import { useLinks } from '@/hooks/use-links';
import { searchCopies } from '@/lib/search';

import { rankCircleCopies, summarizeCircleCopies } from '@/features/book/circle-copies';
import { CatalogueResults } from '@/features/discover/CatalogueResults';
import { DiscoverHome } from '@/features/discover/DiscoverHome';
import { CATALOGUE_MIN_LENGTH } from '@/features/discover/use-catalogue-search';
import { useCircleItems, useNameOf, useRequestedItemIds } from '@/features/shared/hooks';
import { BookRowSkeletons, SectionHeader } from '@/features/shared/ui';
import { wishlistAvailability } from '@/features/wishlist/availability';
import { AvailabilityLine } from '@/features/wishlist/AvailabilityLine';

/** Discover tab (SPEC §6): search your circle's books, or the catalogue when nothing matches. */
export default function DiscoverScreen() {
  const uid = useUid();
  const [q, setQ] = useState('');
  const [showCatalogue, setShowCatalogue] = useState(false);
  const { links, loading: linksLoading } = useLinks();
  const { items, networkItems, loading } = useCircleItems();
  const requestedItemIds = useRequestedItemIds();
  const nameOf = useNameOf();

  const searching = q.trim().length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    return searchCopies(items, q).map((g) => {
      const ranked = rankCircleCopies(g.copies, { uid, requestedItemIds, nameOf });
      const summary = summarizeCircleCopies(ranked);
      return {
        group: g,
        summary,
        availability: wishlistAvailability(summary, nameOf),
        coverUrl: g.copies.find((c) => c.coverUrl)?.coverUrl ?? null,
      };
    });
  }, [items, q, searching, uid, requestedItemIds, nameOf]);

  const onChangeQuery = (text: string) => {
    setQ(text);
    if (!text.trim()) setShowCatalogue(false);
  };

  const catalogueVisible =
    searching &&
    q.trim().length >= CATALOGUE_MIN_LENGTH &&
    (showCatalogue || (!loading && results.length === 0));

  return (
    <Screen
      safeBottom={false}
      header={
        <ScreenHeader
          large
          title="Discover"
          subtitle="Books shared by people you know"
          right={
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onPress={() => router.push('/wishlist')}
              accessibilityLabel="Wishlist"
            >
              <Icon as={Heart} size={20} />
            </Button>
          }
        />
      }
    >
      <View className="w-full max-w-2xl self-center">
        <View className="relative mb-6 justify-center">
          <Icon as={Search} size={18} className="absolute left-3 z-10 text-muted-foreground" />
          <Input
            value={q}
            onChangeText={onChangeQuery}
            placeholder="Search by title or author"
            className="h-11 pl-10 pr-10"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search books"
          />
          {searching ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 rounded-full"
              onPress={() => onChangeQuery('')}
              accessibilityLabel="Clear search"
            >
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Button>
          ) : null}
        </View>

        {searching ? (
          <View className="gap-8">
            {loading ? (
              <BookRowSkeletons count={3} />
            ) : results.length ? (
              <View>
                <SectionHeader
                  title="In your circle"
                  description={`${results.length} ${results.length === 1 ? 'book' : 'books'}`}
                />
                <View className="gap-1">
                  {results.map(({ group, summary, availability, coverUrl }) => (
                    <BookRow
                      key={group.workId}
                      title={group.title}
                      authors={group.authors}
                      coverUrl={coverUrl}
                      href={{ pathname: '/book/[workId]', params: { workId: group.workId } }}
                      meta={<AvailabilityLine availability={availability} />}
                      badge={
                        summary.mineCount ? (
                          <Badge variant="outline">
                            <Text>You own it</Text>
                          </Badge>
                        ) : undefined
                      }
                    />
                  ))}
                </View>
              </View>
            ) : (
              <Card className="flex-row items-center gap-3 px-4 py-4">
                <View className="size-10 items-center justify-center rounded-full bg-muted">
                  <Icon as={Search} size={18} className="text-muted-foreground" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold">No one in your circle has it</Text>
                  <Text className="text-sm text-muted-foreground">
                    {q.trim().length >= CATALOGUE_MIN_LENGTH
                      ? 'Here’s what the catalogue found instead.'
                      : 'Keep typing to search the catalogue.'}
                  </Text>
                </View>
              </Card>
            )}

            {catalogueVisible ? (
              <CatalogueResults query={q} />
            ) : !loading && results.length && q.trim().length >= CATALOGUE_MIN_LENGTH ? (
              <Button variant="outline" onPress={() => setShowCatalogue(true)}>
                <Icon as={Globe} size={16} />
                <Text>Search the catalogue for “{q.trim()}”</Text>
              </Button>
            ) : null}
          </View>
        ) : linksLoading || loading ? (
          <BookRowSkeletons count={4} />
        ) : links.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No one here yet"
            description="When people in your contacts join LendShelf, the books they share show up here. Meanwhile, search above to find books and build your wishlist."
          >
            <Button onPress={() => router.push('/contacts')}>
              <Text>Sync contacts</Text>
            </Button>
            <Button variant="outline" onPress={() => router.push('/add')}>
              <Text>Add your books</Text>
            </Button>
          </EmptyState>
        ) : (
          <>
            <DiscoverHome
              uid={uid}
              links={links}
              items={items}
              networkItems={networkItems}
              requestedItemIds={requestedItemIds}
              nameOf={nameOf}
            />
            {networkItems.length === 0 ? (
              <EmptyState
                icon={BookPlus}
                title="Nothing shared yet"
                description="People you know haven’t shared any books yet. Add yours to get things going."
              >
                <Button onPress={() => router.push('/add')}>
                  <Text>Add a book</Text>
                </Button>
              </EmptyState>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
