import { router } from 'expo-router';
import { FolderCog, Library, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useMyItems } from '@/hooks/use-items';
import { useMyShelves } from '@/hooks/use-shelves';
import { itemStatus } from '@/types/model';

export default function MyBooksScreen() {
  const { items, loading } = useMyItems();
  const { shelves } = useMyShelves();
  const shelfName = new Map(shelves.map((s) => [s.id, s.name]));

  return (
    <Screen
      safeBottom={false}
      header={
        <ScreenHeader
          large
          title="My books"
          subtitle={
            loading
              ? undefined
              : `${items.length} ${items.length === 1 ? 'copy' : 'copies'} · ${shelves.length} ${shelves.length === 1 ? 'collection' : 'collections'}`
          }
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
                onPress={() => router.push('/add')}
                accessibilityLabel="Add a book"
              >
                <Icon as={Plus} size={20} />
              </Button>
            </>
          }
        />
      }
    >
      {loading ? (
        <View className="gap-3">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-row gap-3 px-2">
              <Skeleton className="h-20 w-14 rounded-md" />
              <View className="flex-1 gap-2 pt-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </View>
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Your shelf is empty"
          description="Add the books you own. Scan a barcode, search, or type them in."
        >
          <Button onPress={() => router.push('/add')}>
            <Icon as={Plus} size={16} />
            <Text>Add your first book</Text>
          </Button>
        </EmptyState>
      ) : (
        <View className="gap-1">
          {items.map((item) => (
            <BookRow
              key={item.id}
              title={item.title}
              authors={item.authors}
              coverUrl={item.coverUrl}
              href={{ pathname: '/copy/[itemId]', params: { itemId: item.id } }}
              meta={shelfName.get(item.shelfId)}
              badge={
                <>
                  <StatusBadge status={itemStatus(item)} />
                  {item.visibility === 'hidden' || !item.sharedWithContacts ? (
                    <Badge variant="outline">
                      <Text>Private</Text>
                    </Badge>
                  ) : null}
                </>
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
