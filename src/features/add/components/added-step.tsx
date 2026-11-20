import { Check, Plus } from 'lucide-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

import type { SavedResult } from './confirm-step';

/** Shown after saving: what was added, then add more or close. */
export function AddedStep({
  result,
  onAddMore,
  onDone,
}: {
  result: SavedResult;
  onAddMore(): void;
  onDone(): void;
}) {
  const insets = useSafeAreaInsets();
  const title =
    result.count === 1
      ? `“${result.titles[0] ?? 'Your book'}” is on your shelf`
      : `${result.count} books added`;
  return (
    <View className="flex-1 px-6" style={{ paddingBottom: insets.bottom + 16 }}>
      <View className="flex-1 items-center justify-center gap-5">
        <View className="size-16 items-center justify-center rounded-full bg-emerald-500/15">
          <Icon as={Check} size={30} className="text-emerald-600 dark:text-emerald-400" />
        </View>
        <View className="items-center gap-1.5">
          <Text className="text-center text-xl font-bold tracking-tight">{title}</Text>
          <Text className="text-center text-sm text-muted-foreground">
            Added to {result.shelfName}.
          </Text>
        </View>
      </View>
      <View className="gap-2">
        <Button size="lg" onPress={onDone}>
          <Text>Done</Text>
        </Button>
        <Button size="lg" variant="outline" onPress={onAddMore}>
          <Icon as={Plus} size={16} />
          <Text>Add more books</Text>
        </Button>
      </View>
    </View>
  );
}
