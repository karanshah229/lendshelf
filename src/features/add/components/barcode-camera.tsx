/**
 * Continuous ISBN barcode scanner (expo-camera). The web build uses `barcode-camera.web.tsx`.
 * Every distinct barcode is reported once every few seconds; the parent decides whether it's new.
 */
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Camera, Check, CircleAlert, Flashlight, FlashlightOff, Info } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type ScanOutcome = 'added' | 'duplicate' | 'notIsbn';

export interface BarcodeCameraProps {
  /** Called for each barcode read; returns what happened so the camera can show feedback. */
  onBarcode(data: string): ScanOutcome;
  /** Pause scanning (e.g. while another tab is shown). */
  active: boolean;
}

/** True on platforms where the camera scanner is available. */
export const CAMERA_SCANNING = true;

const REPEAT_MS = 2500;

const FEEDBACK: Record<ScanOutcome, { text: string; icon: typeof Check; tone: string }> = {
  added: { text: 'Got it', icon: Check, tone: 'bg-emerald-600' },
  duplicate: { text: 'Already scanned', icon: Info, tone: 'bg-neutral-700' },
  notIsbn: { text: 'Not a book barcode', icon: CircleAlert, tone: 'bg-amber-600' },
};

export function BarcodeCamera({ onBarcode, active }: BarcodeCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [feedback, setFeedback] = useState<ScanOutcome | null>(null);
  const lastSeen = useRef(new Map<string, number>());
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    []
  );

  const handleScan = (result: BarcodeScanningResult) => {
    const data = result.data;
    if (!data) return;
    const now = Date.now();
    const seen = lastSeen.current.get(data);
    // The camera reports the same code many times a second while it's in view.
    if (seen && now - seen < REPEAT_MS) return;
    lastSeen.current.set(data, now);
    const outcome = onBarcode(data);
    setFeedback(outcome);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 1400);
  };

  if (!permission) {
    return (
      <CameraFrame>
        <ActivityIndicator color="#fff" />
      </CameraFrame>
    );
  }

  if (!permission.granted) {
    return (
      <CameraFrame>
        <View className="items-center gap-3 px-6">
          <View className="size-12 items-center justify-center rounded-full bg-white/10">
            <Icon as={Camera} size={22} className="text-white" />
          </View>
          <Text className="text-center text-sm leading-5 text-white/80">
            {permission.canAskAgain
              ? 'Allow camera access to scan the barcodes on your books.'
              : 'Camera access is turned off for LendShelf. Turn it on in Settings to scan barcodes.'}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            onPress={() =>
              permission.canAskAgain ? void requestPermission() : void Linking.openSettings()
            }
          >
            <Text>{permission.canAskAgain ? 'Allow camera' : 'Open Settings'}</Text>
          </Button>
        </View>
      </CameraFrame>
    );
  }

  const fb = feedback ? FEEDBACK[feedback] : null;

  return (
    <CameraFrame>
      {active ? (
        <CameraView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8'] }}
          onBarcodeScanned={handleScan}
        />
      ) : null}
      {/* Aiming guide */}
      <View pointerEvents="none" className="h-24 w-4/5 rounded-xl border-2 border-white/80" />
      <Text className="absolute bottom-3 text-xs font-medium text-white/90">
        Line up the barcode on the back cover
      </Text>
      <Pressable
        onPress={() => setTorch((t) => !t)}
        className="absolute right-3 top-3 size-9 items-center justify-center rounded-full bg-black/50"
        accessibilityRole="button"
        accessibilityLabel={torch ? 'Turn off the light' : 'Turn on the light'}
      >
        <Icon as={torch ? FlashlightOff : Flashlight} size={18} className="text-white" />
      </Pressable>
      {fb ? (
        <View
          pointerEvents="none"
          className={cn(
            'absolute top-3 flex-row items-center gap-1.5 rounded-full px-3 py-1.5',
            fb.tone
          )}
        >
          <Icon as={fb.icon} size={14} className="text-white" />
          <Text className="text-xs font-semibold text-white">{fb.text}</Text>
        </View>
      ) : null}
    </CameraFrame>
  );
}

function CameraFrame({ children }: { children: React.ReactNode }) {
  return (
    <View className="h-56 items-center justify-center overflow-hidden rounded-xl bg-neutral-900">
      {children}
    </View>
  );
}
