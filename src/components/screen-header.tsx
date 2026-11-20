import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Show a back button. Defaults to true when there's a screen to go back to.
   * Pass a function to handle back yourself.
   */
  back?: boolean | (() => void);
  /** Large left-aligned title for tab roots; compact centered bar otherwise. */
  large?: boolean;
  /** Right-side actions (icon buttons). */
  right?: ReactNode;
  /** Apply the top safe-area inset (default true). */
  safeTop?: boolean;
  className?: string;
}

/** App screen header in the shadcn style. Screens hide the native header and render this. */
export function ScreenHeader({
  title,
  subtitle,
  back,
  large = false,
  right,
  safeTop = true,
  className,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const showBack = back === undefined ? router.canGoBack() : !!back;
  const onBack = typeof back === 'function' ? back : () => router.back();

  if (large) {
    return (
      <View
        className={cn('gap-1 bg-background px-4 pb-3 pt-3', className)}
        style={safeTop ? { paddingTop: insets.top + 12 } : undefined}
      >
        <View className="min-h-10 flex-row items-center justify-between gap-2">
          <Text className="text-3xl font-bold tracking-tight" numberOfLines={1} role="heading">
            {title}
          </Text>
          {right ? <View className="flex-row items-center gap-1">{right}</View> : null}
        </View>
        {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
      </View>
    );
  }

  return (
    <View
      className={cn('border-b border-border bg-background', className)}
      style={safeTop ? { paddingTop: insets.top } : undefined}
    >
      <View className="h-14 flex-row items-center gap-1 px-2">
        <View className="w-12 items-start">
          {showBack ? (
            <Button
              variant="ghost"
              size="icon"
              onPress={onBack}
              accessibilityLabel="Go back"
              className="rounded-full"
            >
              <Icon as={ChevronLeft} size={24} />
            </Button>
          ) : null}
        </View>
        <View className="flex-1 items-center">
          <Text className="text-base font-semibold" numberOfLines={1} role="heading">
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View className="min-w-12 flex-row items-center justify-end gap-1">{right}</View>
      </View>
    </View>
  );
}
