import { Heart } from 'lucide-react-native';

import { ComingSoon } from '@/components/coming-soon';
import { Text } from '@/components/ui/text';
import { useWatches } from '@/hooks/use-watches';

/** Wishlist: Books you'll be notified about when a contact adds them (SPEC §6). Stub. */
export default function WishlistScreen() {
  const { wishlist } = useWatches();
  return (
    <ComingSoon
      title="Wishlist"
      icon={Heart}
      description="Get notified when someone you know adds these books."
    >
      {wishlist.map((w) => (
        <Text key={w.id} className="text-center text-sm">
          {w.title}
        </Text>
      ))}
    </ComingSoon>
  );
}
