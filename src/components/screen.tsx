import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/utils';

export interface ScreenProps {
  children: ReactNode;
  /** Rendered above the content, outside the scroll view (usually a `ScreenHeader`). */
  header?: ReactNode;
  /** Wrap the content in a ScrollView (default true). Use false for FlatList screens. */
  scroll?: boolean;
  /** Avoid the keyboard (forms). */
  keyboard?: boolean;
  /** Pad the bottom safe area (default true; tabs already handle it). */
  safeBottom?: boolean;
  /** Classes for the content container. */
  className?: string;
}

/** Full-height screen with the app background, optional header, scrolling and keyboard handling. */
export function Screen({
  children,
  header,
  scroll = true,
  keyboard = false,
  safeBottom = true,
  className,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const bottom = safeBottom ? insets.bottom : 0;

  const content = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cn('px-4 py-4', className)}
      contentContainerStyle={{ paddingBottom: bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View className={cn('flex-1', className)} style={{ paddingBottom: bottom }}>
      {children}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      {header}
      {keyboard ? (
        <KeyboardAvoidingView
          className="flex-1"
          // Android too: edge-to-edge means adjustResize no longer shrinks the window.
          behavior="padding"
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}
