import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export interface AuthShellProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Step indicator, e.g. { current: 2, total: 4 }. */
  step?: { current: number; total: number };
  /** Show a back button (defaults to whether there's history). */
  back?: boolean | (() => void);
  children: ReactNode;
  /** Pinned to the bottom (primary actions). */
  footer?: ReactNode;
}

/** Layout shared by the sign-in and onboarding screens. */
export function AuthShell({
  icon,
  title,
  description,
  step,
  back,
  children,
  footer,
}: AuthShellProps) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="" back={back} className="border-b-0" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="w-full max-w-md self-center px-6 pb-6 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        {step ? (
          <View
            className="mb-6 flex-row gap-1.5"
            accessibilityLabel={`Step ${step.current} of ${step.total}`}
          >
            {Array.from({ length: step.total }, (_, i) => (
              <View
                key={i}
                className={
                  i < step.current
                    ? 'h-1 flex-1 rounded-full bg-primary'
                    : 'h-1 flex-1 rounded-full bg-muted'
                }
              />
            ))}
          </View>
        ) : null}
        <View className="mb-5 size-12 items-center justify-center rounded-xl bg-primary">
          <Icon as={icon} size={24} className="text-primary-foreground" />
        </View>
        <Text className="text-2xl font-bold tracking-tight" role="heading">
          {title}
        </Text>
        {description ? (
          typeof description === 'string' ? (
            <Text className="mt-2 text-base leading-6 text-muted-foreground">{description}</Text>
          ) : (
            <View className="mt-2">{description}</View>
          )
        ) : null}
        <View className="mt-8 gap-4">{children}</View>
      </ScrollView>
      {footer ? (
        <View
          className="w-full max-w-md gap-2 self-center px-6 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
