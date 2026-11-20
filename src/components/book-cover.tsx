import { Image } from 'expo-image';
import { BookOpen } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

cssInterop(Image, { className: 'style' });

const SIZES = {
  xs: { box: 'w-10', icon: 16, text: 'text-[8px]' },
  sm: { box: 'w-14', icon: 20, text: 'text-[9px]' },
  md: { box: 'w-24', icon: 28, text: 'text-[11px]' },
  lg: { box: 'w-36', icon: 40, text: 'text-sm' },
} as const;

export interface BookCoverProps {
  uri?: string | null;
  /** Shown on the placeholder when there's no cover. */
  title?: string;
  size?: keyof typeof SIZES;
  /** Overrides the width (e.g. `w-full` in a grid). Height follows the 2:3 aspect ratio. */
  className?: string;
}

/**
 * Open Library serves S/M/L cover sizes; L images are ~5× heavier than M and
 * load slowly in lists. Use M everywhere except the large hero cover.
 */
export function coverUriForSize(uri: string, size: keyof typeof SIZES): string {
  if (size === 'lg') return uri;
  return uri.replace(/(covers\.openlibrary\.org\/b\/(?:id|isbn|olid)\/[^/]+)-L\.jpg$/, '$1-M.jpg');
}

/** Book cover with a 2:3 aspect ratio and a tasteful placeholder when missing or broken. */
export function BookCover({ uri, title, size = 'md', className }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const s = SIZES[size];
  const showImage = !!uri && !failed;
  const sourceUri = uri ? coverUriForSize(uri, size) : uri;

  return (
    <View
      className={cn(
        'aspect-[2/3] overflow-hidden rounded-md border border-border bg-muted shadow-sm shadow-black/10',
        s.box,
        className
      )}
      accessibilityRole="image"
      accessibilityLabel={title ? `Cover of ${title}` : 'Book cover'}
    >
      {showImage ? (
        <Image
          source={{ uri: sourceUri ?? undefined }}
          className="h-full w-full"
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
        />
      ) : (
        <View className="flex-1 items-center justify-center gap-1.5 p-1.5">
          <Icon as={BookOpen} size={s.icon} className="text-muted-foreground/70" />
          {title && size !== 'xs' ? (
            <Text
              numberOfLines={3}
              className={cn('text-center font-medium leading-tight text-muted-foreground', s.text)}
            >
              {title}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
