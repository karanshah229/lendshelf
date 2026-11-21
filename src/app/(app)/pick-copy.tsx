import { router } from 'expo-router';
import { BookPlus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { pickableCopies } from '@/features/lend/pick-copy';
import { useMyItems } from '@/hooks/use-items';

const close = () => (router.canGoBack() ? router.back() : router.replace('/loans'));

/** Loans › "Lend a book": pick one of my copies, then the existing Lend screen (E7). */
export default function PickCopyScreen() {
  const { items, loading } = useMyItems();
  const [q, setQ] = useState('');
  const copies = useMemo(() => pickableCopies(items, q), [items, q]);

  return (
    <Screen
      scroll={false}
      keyboard
      header={
        <ScreenHeader
          title="Lend a book"
          subtitle="Which copy?"
          back={close}
          safeTop={Platform.OS !== 'ios'}
        />
      }
    >
      <View className="px-4 pb-2 pt-3">
        <View className="flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
          <Icon as={Search} size={16} className="text-muted-foreground" />
          <Input
            value={q}
            onChangeText={setQ}
            placeholder="Search your books"
            className="flex-1 border-0 bg-transparent px-0 shadow-none"
            accessibilityLabel="Search your books"
            autoCorrect={false}
          />
        </View>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : copies.length ? (
        <FlatList
          data={copies}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-2 pb-8"
          renderItem={({ item }) => (
            <BookRow
              title={item.title}
              authors={item.authors}
              coverUrl={item.coverUrl}
              meta={
                item.visibility === 'lendable'
                  ? 'On your shelf'
                  : item.visibility === 'visible'
                    ? 'Not lending'
                    : 'Hidden'
              }
              onPress={() =>
                router.replace({ pathname: '/lend/[itemId]', params: { itemId: item.id } })
              }
            />
          )}
        />
      ) : (
        <EmptyState
          icon={BookPlus}
          title={q.trim() ? 'No matching books' : 'Nothing to lend'}
          description={
            q.trim()
              ? 'Only books on your shelf right now can be lent.'
              : 'Add a book first. Books that are already out don’t show here.'
          }
        >
          {q.trim() ? null : (
            <Button className="min-h-11" onPress={() => router.replace('/add')}>
              <Text>Add books</Text>
            </Button>
          )}
        </EmptyState>
      )}
    </Screen>
  );
}
