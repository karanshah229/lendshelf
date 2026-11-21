import { router } from 'expo-router';
import { FolderCog, Plus, SearchX } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';

import { EmptyState, LoadErrorState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CopyGridCard, CopyListRow } from '@/features/library/components/copy-card';
import { LibraryWelcome } from '@/features/library/components/library-empty';
import { LibraryToolbar, type LibraryView } from '@/features/library/components/library-toolbar';
import {
  ALL_SHELVES,
  countCopies,
  filterCopies,
  ownerStatus,
  type QuickFilter,
  type ShelfFilter,
} from '@/features/library/filter';
import { useMyItems } from '@/hooks/use-items';
import { useMyShelves } from '@/hooks/use-shelves';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function MyBooksScreen() {
  const { items, loading: itemsLoading, error: itemsError, retry: retryItems } = useMyItems();
  const { shelves, loading: shelvesLoading } = useMyShelves();
  const { width } = useWindowDimensions();

  const [shelfChoice, setShelfChoice] = useState<ShelfFilter>(ALL_SHELVES);
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<LibraryView>('grid');

  // A deleted collection falls back to "All".
  const shelfId =
    shelfChoice === ALL_SHELVES || shelves.some((s) => s.id === shelfChoice)
      ? shelfChoice
      : ALL_SHELVES;

  const shelfById = useMemo(() => new Map(shelves.map((s) => [s.id, s])), [shelves]);
  const counts = useMemo(() => countCopies(items, shelfId), [items, shelfId]);
  const visible = useMemo(
    () => filterCopies(items, { shelfId, filter, query }),
    [items, shelfId, filter, query]
  );

  const loading = itemsLoading || shelvesLoading;
  const columns = width >= 1000 ? 7 : width >= 720 ? 5 : width >= 520 ? 4 : 3;
  const isEmptyLibrary = !loading && !itemsError && items.length === 0;

  const addBook = () =>
    router.push({
      pathname: '/add',
      params: shelfId === ALL_SHELVES ? {} : { shelfId },
    });

  const subtitle =
    loading || itemsError
      ? undefined
      : `${plural(items.length, 'book', 'books')} · ${plural(shelves.length, 'collection', 'collections')}`;

  return (
    <Screen
      scroll={false}
      safeBottom={false}
      header={
        <ScreenHeader
          large
          title="My books"
          subtitle={subtitle}
          right={
            <>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onPress={() => router.push('/shelves')}
                accessibilityLabel="Collections"
              >
                <Icon as={FolderCog} size={20} />
              </Button>
              <Button
                size="icon"
                className="rounded-full"
                onPress={addBook}
                accessibilityLabel="Add a book"
              >
                <Icon as={Plus} size={20} className="text-primary-foreground" />
              </Button>
            </>
          }
        />
      }
    >
      {loading ? (
        <LibrarySkeleton columns={columns} />
      ) : itemsError ? (
        <LoadErrorState title="Couldn’t load your books" onRetry={retryItems} />
      ) : isEmptyLibrary ? (
        <LibraryWelcome />
      ) : (
        <FlatList
          key={view === 'grid' ? `grid-${columns}` : 'list'}
          data={visible}
          keyExtractor={(item) => item.id}
          numColumns={view === 'grid' ? columns : 1}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={
            <LibraryToolbar
              shelves={shelves}
              shelfId={shelfId}
              onShelfChange={setShelfChoice}
              totalCount={items.length}
              counts={counts}
              filter={filter}
              onFilterChange={setFilter}
              query={query}
              onQueryChange={setQuery}
              view={view}
              onViewChange={setView}
            />
          }
          renderItem={({ item }) => {
            const shelf = shelfById.get(item.shelfId);
            const status = ownerStatus(item, shelf?.isPublic ?? true);
            return view === 'grid' ? (
              <View style={{ width: `${100 / columns}%` }} className="px-1.5 pb-3">
                <CopyGridCard item={item} status={status} />
              </View>
            ) : (
              <View className="px-2">
                <CopyListRow
                  item={item}
                  status={status}
                  shelfName={shelfId === ALL_SHELVES ? shelf?.name : undefined}
                />
              </View>
            );
          }}
          columnWrapperStyle={view === 'grid' ? { paddingHorizontal: 10 } : undefined}
          ListEmptyComponent={
            <EmptyState
              icon={SearchX}
              title={query ? 'No matches' : emptyTitle(filter)}
              description={
                query
                  ? `Nothing in ${shelfId === ALL_SHELVES ? 'your books' : (shelfById.get(shelfId)?.name ?? 'this collection')} matches “${query.trim()}”.`
                  : emptyDescription(filter)
              }
            >
              {filter === 'all' && !query ? (
                <Button onPress={addBook}>
                  <Icon as={Plus} size={16} className="text-primary-foreground" />
                  <Text>Add a book here</Text>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onPress={() => {
                    setQuery('');
                    setFilter('all');
                  }}
                >
                  <Text>Show all</Text>
                </Button>
              )}
            </EmptyState>
          }
        />
      )}
    </Screen>
  );
}

function emptyTitle(filter: QuickFilter): string {
  if (filter === 'lent') return 'Nothing out with friends';
  if (filter === 'notLending') return 'Nothing set to Not lending';
  if (filter === 'hidden') return 'No hidden books';
  return 'This collection is empty';
}

function emptyDescription(filter: QuickFilter): string {
  if (filter === 'lent') return 'Books you lend to someone show up here with their due date.';
  if (filter === 'notLending')
    return 'People who have your number saved can see these books, but can’t ask to borrow them.';
  if (filter === 'hidden') return 'Hidden books are only visible to you.';
  return 'Add books to this collection, or move them here from a book’s page.';
}

function LibrarySkeleton({ columns }: { columns: number }) {
  return (
    <View className="gap-4 px-4 pt-1">
      <View className="flex-row gap-2">
        {[64, 96, 80].map((w) => (
          <Skeleton key={w} className="h-8 rounded-full" style={{ width: w }} />
        ))}
      </View>
      <Skeleton className="h-10 w-full" />
      <View className="-mx-1.5 flex-row flex-wrap">
        {Array.from({ length: columns * 2 }, (_, i) => (
          <View key={i} style={{ width: `${100 / columns}%` }} className="gap-2 px-1.5 pb-4">
            <Skeleton className="aspect-[2/3] w-full rounded-md" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </View>
        ))}
      </View>
    </View>
  );
}
