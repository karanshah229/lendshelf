import { Tabs } from 'expo-router/js-tabs';
import { ArrowLeftRight, House, Library, UserRound, type LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { needsYouBadge } from '@/features/loans/needs-you';
import { useNeedsYou } from '@/features/loans/use-needs-you';
import { THEME } from '@/lib/theme';

function tabIcon(icon: LucideIcon) {
  const TabIcon = ({
    color,
    size,
    focused,
  }: {
    color: ColorValue;
    size: number;
    focused: boolean;
  }) => {
    const Lucide = icon;
    return <Lucide color={String(color)} size={size - 2} strokeWidth={focused ? 2.25 : 1.75} />;
  };
  return TabIcon;
}

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme];
  // One badge in the app: the number of Needs-you cards (F5).
  const { cards } = useNeedsYou();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.foreground,
        tabBarInactiveTintColor: t.mutedForeground,
        tabBarStyle: { backgroundColor: t.background, borderTopColor: t.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon(House) }} />
      <Tabs.Screen name="my-books" options={{ title: 'My books', tabBarIcon: tabIcon(Library) }} />
      <Tabs.Screen
        name="loans"
        options={{
          title: 'Loans',
          tabBarIcon: tabIcon(ArrowLeftRight),
          tabBarBadge: needsYouBadge(cards),
          tabBarAccessibilityLabel: cards.length
            ? `Loans, ${cards.length} need${cards.length === 1 ? 's' : ''} you`
            : 'Loans',
          tabBarBadgeStyle: { backgroundColor: t.destructive, color: '#fff', fontSize: 10 },
        }}
      />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: tabIcon(UserRound) }} />
    </Tabs>
  );
}
