import { router, type Href } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-1 pb-2 pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </Text>
  );
}

/** Settings-style row inside a Card: icon, label, optional detail and a chevron when pressable. */
export function Row({
  icon,
  label,
  detail,
  href,
  onPress,
  right,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  href?: Href;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
}) {
  const press = onPress ?? (href ? () => router.push(href) : undefined);
  return (
    <Pressable
      onPress={press}
      disabled={!press}
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-accent"
      accessibilityRole={press ? 'button' : undefined}
    >
      <View
        className={cn(
          'size-8 items-center justify-center rounded-md bg-muted',
          destructive && 'bg-destructive/10'
        )}
      >
        <Icon
          as={icon}
          size={16}
          className={destructive ? 'text-destructive' : 'text-muted-foreground'}
        />
      </View>
      <View className="flex-1">
        <Text className={cn('text-sm font-medium', destructive && 'text-destructive')}>
          {label}
        </Text>
        {detail ? <Text className="text-xs text-muted-foreground">{detail}</Text> : null}
      </View>
      {right ??
        (press ? <Icon as={ChevronRight} size={16} className="text-muted-foreground" /> : null)}
    </Pressable>
  );
}
