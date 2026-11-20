/**
 * Web build: camera barcode scanning isn't reliable in browsers, so the Scan tab shows the
 * ISBN field only. Same surface as `barcode-camera.tsx`.
 */
import { Smartphone } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export type ScanOutcome = 'added' | 'duplicate' | 'notIsbn';

export interface BarcodeCameraProps {
  onBarcode(data: string): ScanOutcome;
  active: boolean;
}

export const CAMERA_SCANNING = false;

export function BarcodeCamera(_props: BarcodeCameraProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-4">
      <View className="size-10 items-center justify-center rounded-full bg-background">
        <Icon as={Smartphone} size={20} className="text-muted-foreground" />
      </View>
      <Text className="flex-1 text-sm leading-5 text-muted-foreground">
        Barcode scanning works in the LendShelf app on your phone. Here, type the ISBN printed above
        the barcode.
      </Text>
    </View>
  );
}
