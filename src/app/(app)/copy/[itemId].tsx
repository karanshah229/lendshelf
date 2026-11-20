import { useLocalSearchParams } from 'expo-router';
import { BookCopy } from 'lucide-react-native';
import { View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useItem } from '@/hooks/use-items';
import { useDisplayName } from '@/hooks/use-links';
import { itemStatus } from '@/types/model';

/** Copy page (SPEC §6). Stub: header and status only. */
export default function CopyScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { item, loading } = useItem(itemId);
  const owner = useDisplayName(item?.ownerId);

  return (
    <Screen header={<ScreenHeader title="Copy" />}>
      {loading ? (
        <Skeleton className="h-52 w-36 self-center rounded-md" />
      ) : item ? (
        <View className="items-center gap-3">
          <BookCover uri={item.coverUrl} title={item.title} size="lg" />
          <Text className="text-center text-2xl font-bold tracking-tight">{item.title}</Text>
          <Text className="text-muted-foreground">{item.authors.join(', ')}</Text>
          <Text className="text-sm">Owner: {owner}</Text>
          <StatusBadge status={itemStatus(item)} />
          <EmptyState
            title="More coming soon"
            description="Ask to borrow, WhatsApp, owner actions and reviews."
          />
        </View>
      ) : (
        <EmptyState
          icon={BookCopy}
          title="Copy not found"
          description="It may have been removed or isn’t shared with you."
        />
      )}
    </Screen>
  );
}
