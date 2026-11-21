import { CloudOff, RotateCw, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Buttons or links shown under the text. */
  children?: ReactNode;
  className?: string;
}

/** Centered placeholder for empty lists and not-yet-built screens. */
export function EmptyState({ icon, title, description, children, className }: EmptyStateProps) {
  return (
    <View className={cn('items-center justify-center gap-4 px-8 py-12', className)}>
      {icon ? (
        <View className="size-14 items-center justify-center rounded-full bg-muted">
          <Icon as={icon} size={26} className="text-muted-foreground" />
        </View>
      ) : null}
      <View className="items-center gap-1.5">
        <Text className="text-center text-lg font-semibold">{title}</Text>
        {description ? (
          <Text className="max-w-sm text-center text-sm leading-5 text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </View>
      {children ? <View className="w-full max-w-xs items-stretch gap-2">{children}</View> : null}
    </View>
  );
}

/** A live list that failed to load (listener error), with a Retry button. */
export function LoadErrorState({
  title,
  description = 'Check your connection and try again.',
  onRetry,
  className,
}: {
  title: string;
  description?: string;
  onRetry(): void;
  className?: string;
}) {
  return (
    <EmptyState icon={CloudOff} title={title} description={description} className={className}>
      <Button variant="outline" onPress={onRetry}>
        <Icon as={RotateCw} size={16} />
        <Text>Retry</Text>
      </Button>
    </EmptyState>
  );
}
