import { router } from 'expo-router';
import { Compass, Search, Users, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useLinkMap, useLinks } from '@/hooks/use-links';
import { useNetworkItems } from '@/hooks/use-items';
import { searchCopies } from '@/lib/search';
import { itemStatus } from '@/types/model';

export default function DiscoverScreen() {
  const [q, setQ] = useState('');
  const { links, loading: linksLoading } = useLinks();
  const linkMap = useLinkMap();
  const { items, loading } = useNetworkItems();

  const searching = q.trim().length > 0;
  const groups = useMemo(() => (searching ? searchCopies(items, q) : []), [items, q, searching]);
  const recent = useMemo(() => items.slice(0, 12), [items]);

  return (
    <Screen
      safeBottom={false}
      header={<ScreenHeader large title="Discover" subtitle="Books shared by people you know" />}
    >
      <View className="relative mb-4 justify-center">
        <Icon as={Search} size={18} className="absolute left-3 z-10 text-muted-foreground" />
        <Input
          value={q}
          onChangeText={setQ}
          placeholder="Search by title or author"
          className="h-11 pl-10 pr-10"
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search books"
        />
        {searching ? (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0.5 rounded-full"
            onPress={() => setQ('')}
            accessibilityLabel="Clear search"
          >
            <Icon as={X} size={16} className="text-muted-foreground" />
          </Button>
        ) : null}
      </View>

      {linksLoading || loading ? (
        <View className="gap-3">
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-row gap-3 px-2">
              <Skeleton className="h-20 w-14 rounded-md" />
              <View className="flex-1 gap-2 pt-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </View>
            </View>
          ))}
        </View>
      ) : links.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No one here yet"
          description="When people in your contacts join LendShelf, the books they share show up here."
        >
          <Button variant="outline" onPress={() => router.push('/contacts')}>
            <Text>Sync contacts</Text>
          </Button>
        </EmptyState>
      ) : searching ? (
        groups.length ? (
          <View className="gap-1">
            {groups.map((g) => (
              <BookRow
                key={g.workId}
                title={g.title}
                authors={g.authors}
                coverUrl={g.copies[0]?.coverUrl}
                href={{ pathname: '/book/[workId]', params: { workId: g.workId } }}
                meta={g.copies
                  .map((c) => linkMap.get(c.ownerId)?.displayName ?? 'Someone')
                  .join(', ')}
                badge={<StatusBadge status={itemStatus(g.copies[0]!)} />}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            icon={Search}
            title="No matches in your circle"
            description="Catalogue search and the wishlist are coming soon."
          />
        )
      ) : recent.length ? (
        <View className="gap-2">
          <Text className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            New from your contacts
          </Text>
          <View className="gap-1">
            {recent.map((item) => (
              <BookRow
                key={item.id}
                title={item.title}
                authors={item.authors}
                coverUrl={item.coverUrl}
                href={{ pathname: '/copy/[itemId]', params: { itemId: item.id } }}
                meta={linkMap.get(item.ownerId)?.displayName}
                badge={<StatusBadge status={itemStatus(item)} />}
              />
            ))}
          </View>
        </View>
      ) : (
        <EmptyState
          icon={Compass}
          title="Nothing shared yet"
          description="Your contacts haven’t shared any books yet. Add yours to get things going."
        >
          <Button onPress={() => router.push('/add')}>
            <Text>Add a book</Text>
          </Button>
        </EmptyState>
      )}
    </Screen>
  );
}
