import { router } from 'expo-router';
import { Keyboard, PenLine, ScanBarcode, Search } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** First-run state for My books: start by scanning the shelf. */
export function LibraryWelcome() {
  return (
    <View className="flex-1 items-center justify-center px-6 py-10">
      <View className="w-full max-w-sm items-center gap-6">
        <View className="size-20 items-center justify-center rounded-3xl bg-primary shadow-lg shadow-black/20">
          <Icon as={ScanBarcode} size={38} className="text-primary-foreground" />
        </View>
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-bold tracking-tight">Scan your shelf</Text>
          <Text className="text-center text-base leading-6 text-muted-foreground">
            Point your camera at the barcode on the back of each book. We fill in the title, author
            and cover, and your friends can see what you have.
          </Text>
        </View>
        <View className="w-full gap-2">
          <Button
            size="lg"
            onPress={() => router.push({ pathname: '/add', params: { mode: 'scan' } })}
          >
            <Icon as={ScanBarcode} size={18} className="text-primary-foreground" />
            <Text>Scan books</Text>
          </Button>
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => router.push({ pathname: '/add', params: { mode: 'search' } })}
            >
              <Icon as={Search} size={16} />
              <Text>Search</Text>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => router.push({ pathname: '/add', params: { mode: 'manual' } })}
            >
              <Icon as={PenLine} size={16} />
              <Text>Type it in</Text>
            </Button>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Icon as={Keyboard} size={14} className="text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">
            No barcode? Search by title or type the details.
          </Text>
        </View>
      </View>
    </View>
  );
}
