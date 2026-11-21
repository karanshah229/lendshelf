/**
 * Home's Needs-you stack (UX §D4, R13): at most 2 cards, then "See all n in Loans ›". Nothing
 * when empty. `NeedsYouList` stays mounted even with no cards, because it owns the sheets (the
 * accept success sheet outlives the card it came from).
 */
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { homeNeedsYou, seeAllLabel } from '@/features/home/home';
import { NeedsYouList } from '@/features/loans/needs-you-card';
import type { NeedsYouCard } from '@/features/loans/needs-you';

export function HomeNeedsYou({
  cards,
  hidden,
}: {
  cards: readonly NeedsYouCard[];
  /** While searching: show no cards, but keep the sheets mounted. */
  hidden?: boolean;
}) {
  const { shown, seeAll } = homeNeedsYou(hidden ? [] : cards);
  return (
    <View className={shown.length ? 'gap-1' : undefined}>
      <NeedsYouList cards={shown} compact />
      {seeAll ? (
        <Pressable
          onPress={() => router.navigate('/loans')}
          accessibilityRole="link"
          accessibilityLabel={`${seeAllLabel(seeAll)}. Opens Loans`}
          hitSlop={{ top: 4, bottom: 4 }}
          className="min-h-10 flex-row items-center justify-end gap-0.5 self-end rounded-md px-1 active:opacity-70"
        >
          <Text className="text-sm font-medium text-primary">{seeAllLabel(seeAll)}</Text>
          <Icon as={ChevronRight} size={16} className="text-primary" />
        </Pressable>
      ) : null}
    </View>
  );
}
