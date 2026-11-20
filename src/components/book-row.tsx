import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface BookRowProps {
  title: string;
  authors: string[];
  coverUrl?: string | null;
  /** Line under the authors (owner names, edition, …). */
  meta?: ReactNode;
  /** Badges on the right / under the text. */
  badge?: ReactNode;
  href?: Parameters<typeof router.push>[0];
  onPress?: () => void;
  className?: string;
}

/** List row for a Book or copy: cover, title, authors, meta and a status badge. */
export function BookRow({
  title,
  authors,
  coverUrl,
  meta,
  badge,
  href,
  onPress,
  className,
}: BookRowProps) {
  const handlePress = onPress ?? (href ? () => router.push(href) : undefined);
  return (
    <Pressable
      onPress={handlePress}
      disabled={!handlePress}
      className={cn('flex-row items-center gap-3 rounded-lg px-2 py-2 active:bg-accent', className)}
      accessibilityRole={handlePress ? 'button' : undefined}
    >
      <BookCover uri={coverUrl} title={title} size="sm" />
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold leading-5" numberOfLines={2}>
          {title}
        </Text>
        {authors.length ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {authors.join(', ')}
          </Text>
        ) : null}
        {meta ? (
          typeof meta === 'string' ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {meta}
            </Text>
          ) : (
            meta
          )
        ) : null}
        {badge ? <View className="flex-row flex-wrap gap-1.5 pt-0.5">{badge}</View> : null}
      </View>
      {handlePress ? <Icon as={ChevronRight} size={18} className="text-muted-foreground" /> : null}
    </Pressable>
  );
}
