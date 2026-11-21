import { router } from 'expo-router';
import { Keyboard, PenLine, ScanBarcode, Search } from 'lucide-react-native';
import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { libraryWelcomeLine } from '@/features/first-run/first-run';
import { useLinks } from '@/hooks/use-links';

/** Scanning needs a camera; the web build leads with search (E2a). */
const CAN_SCAN = Platform.OS !== 'web';

/**
 * First-run state for My books (E2a): start by scanning the shelf (web: search), plus one line
 * for the user's case: who will see what they add, or that lending works before friends join.
 */
export function LibraryWelcome() {
  const { links } = useLinks();
  const line = libraryWelcomeLine(links.map((l) => l.displayName));
  const scan = () => router.push({ pathname: '/add', params: { mode: 'scan' } });
  const search = () => router.push({ pathname: '/add', params: { mode: 'search' } });
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
            and cover.
          </Text>
          <Text className="text-center text-sm leading-5">{line}</Text>
        </View>
        <View className="w-full gap-2">
          <Button size="lg" onPress={CAN_SCAN ? scan : search}>
            <Icon
              as={CAN_SCAN ? ScanBarcode : Search}
              size={18}
              className="text-primary-foreground"
            />
            <Text>{CAN_SCAN ? 'Scan books' : 'Search for a book'}</Text>
          </Button>
          <View className="flex-row gap-2">
            {CAN_SCAN ? (
              <Button variant="outline" className="min-h-12 flex-1" onPress={search}>
                <Icon as={Search} size={16} />
                <Text>Search</Text>
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="min-h-12 flex-1"
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
