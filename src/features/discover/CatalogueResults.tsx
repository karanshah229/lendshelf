/**
 * Open Library catalogue results on Discover: open the Book (resolveBook → /book/[workId])
 * or add it to the wishlist.
 */
import { router } from 'expo-router';
import { Globe, Heart, RotateCw } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useUid } from '@/hooks/use-auth';
import { useWatches } from '@/hooks/use-watches';
import { api } from '@/lib/api';
import { errorCode } from '@/lib/errors';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

import type { CatalogueResult } from '@/features/discover/catalogue';
import { useCatalogueSearch } from '@/features/discover/use-catalogue-search';
import { setWishlisted } from '@/features/shared/mutations';
import { BookRowSkeletons, SectionHeader } from '@/features/shared/ui';

function resolveError(e: unknown) {
  if (errorCode(e) === 'not-found') toast.error('Couldn’t find that book in the catalogue.');
  else toastError(e, 'Couldn’t open that book. Please try again.');
}

function CatalogueRow({
  result,
  uid,
  wishlisted,
}: {
  result: CatalogueResult;
  uid: string;
  wishlisted: boolean;
}) {
  const [busy, setBusy] = useState<'open' | 'wish' | null>(null);

  const open = async () => {
    setBusy('open');
    try {
      const res = await api.resolveBook({ olWorkKey: result.olWorkKey });
      router.push({ pathname: '/book/[workId]', params: { workId: res.workId } });
    } catch (e) {
      resolveError(e);
    } finally {
      setBusy(null);
    }
  };

  const toggleWish = async () => {
    setBusy('wish');
    try {
      if (wishlisted) {
        await setWishlisted(uid, { workId: result.workId, title: result.title }, false);
        toast.success('Removed from your wishlist');
      } else {
        // Make sure the Book exists so contacts adding it later trigger the notification.
        const res = await api.resolveBook({ olWorkKey: result.olWorkKey });
        await setWishlisted(uid, { workId: res.workId, title: res.work.title }, true);
        toast.success('Added to your wishlist', {
          description: 'We’ll let you know when someone you know adds it.',
        });
      }
    } catch (e) {
      resolveError(e);
    } finally {
      setBusy(null);
    }
  };

  const meta = [result.authors.join(', '), result.firstPublishYear].filter(Boolean).join(' · ');

  return (
    <View className="flex-row items-center gap-1 pr-2">
      <Pressable
        onPress={open}
        disabled={!!busy}
        className="flex-1 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
        accessibilityRole="button"
        accessibilityLabel={`Open ${result.title}`}
      >
        <BookCover uri={result.coverUrl} title={result.title} size="sm" />
        <View className="flex-1 gap-1">
          <Text className="font-semibold leading-5" numberOfLines={2}>
            {result.title}
          </Text>
          {meta ? (
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {busy === 'open' ? <ActivityIndicator size="small" /> : null}
      </Pressable>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onPress={toggleWish}
        disabled={!!busy}
        accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        accessibilityState={{ selected: wishlisted }}
      >
        {busy === 'wish' ? (
          <ActivityIndicator size="small" />
        ) : (
          <Icon
            as={Heart}
            size={18}
            className={cn(wishlisted ? 'text-rose-500' : 'text-muted-foreground')}
            fill={wishlisted ? 'currentColor' : 'transparent'}
          />
        )}
      </Button>
    </View>
  );
}

export function CatalogueResults({ query }: { query: string }) {
  const { state, retry } = useCatalogueSearch(query, true);
  const uid = useUid();
  const { isWishlisted } = useWatches();

  return (
    <View>
      <SectionHeader
        title="From the catalogue"
        description="Open a book to see reviews, or add it to your wishlist"
        action={<Icon as={Globe} size={14} className="mb-0.5 text-muted-foreground" />}
      />
      {state.status === 'idle' ? (
        <Text className="px-1 text-sm text-muted-foreground">Type a little more to search.</Text>
      ) : state.status === 'loading' ? (
        <BookRowSkeletons count={3} />
      ) : state.status === 'error' ? (
        <Card className="items-center gap-3 px-6 py-6">
          <Text className="text-center text-sm text-muted-foreground">
            Couldn’t reach the Open Library catalogue.
          </Text>
          <Button variant="outline" size="sm" onPress={retry}>
            <Icon as={RotateCw} size={14} />
            <Text>Try again</Text>
          </Button>
        </Card>
      ) : state.results.length === 0 ? (
        <Card className="px-6 py-6">
          <Text className="text-center text-sm text-muted-foreground">
            No books found for “{query.trim()}”. Check the spelling or try the author’s name.
          </Text>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          {state.results.map((r, i) => (
            <View key={r.olWorkKey} className={i > 0 ? 'border-t border-border' : undefined}>
              <CatalogueRow result={r} uid={uid} wishlisted={isWishlisted(r.workId)} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
