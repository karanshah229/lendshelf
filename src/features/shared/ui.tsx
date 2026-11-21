/**
 * Small presentational pieces shared by the Discover / Book / Copy / Person / Wishlist screens.
 */
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

import { initials } from '@/features/shared/people';

/** Section heading with an optional right-side action. */
export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('mb-2 flex-row items-end justify-between gap-3 px-1', className)}>
      <View className="flex-1 gap-0.5">
        <Text
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          role="heading"
        >
          {title}
        </Text>
        {description ? <Text className="text-xs text-muted-foreground">{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const AVATAR_SIZES = {
  sm: { box: 'size-8', text: 'text-xs' },
  md: { box: 'size-10', text: 'text-sm' },
  lg: { box: 'size-16', text: 'text-xl' },
} as const;

/** Initials avatar for a person. */
export function PersonAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const s = AVATAR_SIZES[size];
  return (
    // Decorative initials: the name is always written beside it (F8).
    <Avatar alt={name} className={cn(s.box, className)} aria-hidden>
      <AvatarFallback>
        <Text className={cn('font-semibold text-muted-foreground', s.text)}>{initials(name)}</Text>
      </AvatarFallback>
    </Avatar>
  );
}

/** A compact label/value line used for edition details. */
export function DetailRow({
  icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3 py-2.5">
      <Icon as={icon} size={16} className="text-muted-foreground" />
      <Text className="w-24 text-sm text-muted-foreground">{label}</Text>
      {typeof value === 'string' ? (
        <Text className="flex-1 text-sm font-medium" selectable>
          {value}
        </Text>
      ) : (
        <View className="flex-1">{value}</View>
      )}
    </View>
  );
}

/**
 * Pressable list row with a leading element (avatar/icon), text and trailing content.
 * Interactive trailing content (e.g. a button) goes in `action`, which sits beside the
 * pressable area rather than inside it (a button inside a button is invalid on web).
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  action,
  onPress,
  className,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  action?: ReactNode;
  onPress?: () => void;
  className?: string;
  accessibilityLabel?: string;
}) {
  const row = (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        'flex-row items-center gap-3 px-4 py-3 active:bg-accent',
        action ? 'flex-1 pr-2' : null,
        className
      )}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {leading}
      <View className="flex-1 gap-0.5">
        {typeof title === 'string' ? (
          <Text className="text-sm font-medium" numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
  if (!action) return row;
  return (
    <View className="flex-row items-center">
      {row}
      <View className="pr-4">{action}</View>
    </View>
  );
}

/** Skeleton rows matching BookRow. */
export function BookRowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="flex-row gap-3 px-2">
          <Skeleton className="h-20 w-14 rounded-md" />
          <View className="flex-1 gap-2 pt-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Skeleton for the large Book/Copy header. */
export function BookHeaderSkeleton() {
  return (
    <View className="items-center gap-3">
      <Skeleton className="h-52 w-36 rounded-md" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-4 w-40" />
      <View className="mt-2 w-full flex-row gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </View>
    </View>
  );
}
