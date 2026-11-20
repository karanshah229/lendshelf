import { useLocalSearchParams } from 'expo-router';
import { UserRound } from 'lucide-react-native';

import { ComingSoon } from '@/components/coming-soon';
import { Text } from '@/components/ui/text';
import { useOwnerItems } from '@/hooks/use-items';
import { useDisplayName } from '@/hooks/use-links';

/** A contact's public collections and shared copies (SPEC §6). Stub. */
export default function PersonScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const name = useDisplayName(uid);
  const { items } = useOwnerItems(uid);
  return (
    <ComingSoon
      title={name}
      icon={UserRound}
      description="Their public collections and shared copies."
    >
      <Text className="text-center text-sm text-muted-foreground">
        {items.length} shared {items.length === 1 ? 'copy' : 'copies'}
      </Text>
    </ComingSoon>
  );
}
