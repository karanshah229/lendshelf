import { Barcode, ChevronRight, PenLine, RefreshCw, Search, SearchX, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { formatIsbn, looksLikeIsbn, normaliseIsbn } from '@/features/add/isbn';
import type { OlSearchResult } from '@/features/add/open-library';
import { useOlSearch } from '@/features/add/use-ol-search';
import { cn } from '@/lib/utils';

export interface SearchPanelProps {
  /** workIds I already own a copy of. */
  ownedWorkIds: ReadonlySet<string>;
  /** Key of the result being resolved (work key or ISBN), to show a spinner. */
  resolvingKey: string | null;
  onPickWork(result: OlSearchResult): void;
  onPickIsbn(isbn: string): void;
  onManual(prefill: { title?: string; isbn?: string }): void;
}

/** Title/author search against Open Library. */
export function SearchPanel({
  ownedWorkIds,
  resolvingKey,
  onPickWork,
  onPickIsbn,
  onManual,
}: SearchPanelProps) {
  const [text, setText] = useState('');
  const search = useOlSearch(text);
  const typedIsbn = looksLikeIsbn(text) ? normaliseIsbn(text) : null;
  const busy = resolvingKey !== null;

  return (
    <View className="flex-1">
      <View className="px-4 pb-3">
        <View className="relative justify-center">
          <View className="absolute left-3 z-10" pointerEvents="none">
            <Icon as={Search} size={16} className="text-muted-foreground" />
          </View>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="Title, author or ISBN"
            autoFocus={Platform.OS === 'web'}
            autoCorrect={false}
            returnKeyType="search"
            className="pl-9 pr-9"
            accessibilityLabel="Search for a book"
          />
          {text ? (
            <Pressable
              onPress={() => setText('')}
              className="absolute right-1 size-8 items-center justify-center rounded-full active:bg-accent"
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-2 pb-8"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {typedIsbn ? (
          <Pressable
            onPress={() => onPickIsbn(typedIsbn)}
            disabled={busy}
            className="mx-2 mb-2 flex-row items-center gap-3 rounded-lg border border-border bg-card p-3 active:bg-accent"
            accessibilityRole="button"
          >
            <View className="size-10 items-center justify-center rounded-md bg-muted">
              <Icon as={Barcode} size={20} className="text-foreground" />
            </View>
            <View className="flex-1">
              <Text className="font-medium">Look up this ISBN</Text>
              <Text className="text-sm text-muted-foreground">{formatIsbn(typedIsbn)}</Text>
            </View>
            {resolvingKey === typedIsbn ? (
              <ActivityIndicator />
            ) : (
              <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
            )}
          </Pressable>
        ) : null}

        {search.query.length < 2 ? (
          <SearchHint onManual={() => onManual({})} />
        ) : search.error ? (
          <EmptyState icon={RefreshCw} title="Search didn’t work" description={search.error}>
            <Button variant="outline" onPress={search.retry}>
              <Text>Try again</Text>
            </Button>
          </EmptyState>
        ) : search.loading && !search.results.length ? (
          <ResultsSkeleton />
        ) : !search.results.length ? (
          <EmptyState
            icon={SearchX}
            title="No matches"
            description="Try the author’s name, fewer words, or add the book yourself."
          >
            <Button variant="outline" onPress={() => onManual({ title: search.query })}>
              <Icon as={PenLine} size={16} />
              <Text>Add “{truncate(search.query, 24)}” yourself</Text>
            </Button>
          </EmptyState>
        ) : (
          <View className={cn('gap-0.5', search.loading && 'opacity-60')}>
            {search.results.map((r) => (
              <ResultRow
                key={r.workKey}
                result={r}
                owned={ownedWorkIds.has(`ol_${r.workKey}`)}
                resolving={resolvingKey === r.workKey}
                disabled={busy}
                onPress={() => onPickWork(r)}
              />
            ))}
            <Pressable
              onPress={() => onManual({ title: search.query })}
              className="mx-2 mt-3 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 active:bg-accent"
              accessibilityRole="button"
            >
              <Icon as={PenLine} size={16} className="text-muted-foreground" />
              <Text className="text-sm text-muted-foreground">Not here? Add it yourself</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** One catalogue result (also used by the manual panel's "Is it one of these?"). */
export function ResultRow({
  result,
  owned,
  resolving,
  disabled,
  onPress,
}: {
  result: OlSearchResult;
  owned: boolean;
  resolving: boolean;
  disabled: boolean;
  onPress(): void;
}) {
  const meta = [
    result.firstPublishYear ? String(result.firstPublishYear) : null,
    result.editionCount > 1 ? `${result.editionCount} editions` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${result.title}${result.authors.length ? ` by ${result.authors.join(', ')}` : ''}`}
      className={cn(
        'flex-row items-center gap-3 rounded-lg px-2 py-2 active:bg-accent',
        Platform.select({ web: 'hover:bg-accent/60' })
      )}
    >
      <BookCover uri={result.coverUrl} title={result.title} size="sm" />
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-semibold leading-5" numberOfLines={2}>
          {result.title}
        </Text>
        {result.authors.length ? (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {result.authors.join(', ')}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap items-center gap-1.5 pt-0.5">
          {meta ? <Text className="text-xs text-muted-foreground">{meta}</Text> : null}
          {owned ? (
            <Badge variant="secondary">
              <Text>In your books</Text>
            </Badge>
          ) : null}
        </View>
      </View>
      {resolving ? (
        <ActivityIndicator />
      ) : (
        <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
      )}
    </Pressable>
  );
}

function ResultsSkeleton() {
  return (
    <View className="gap-3 px-2 pt-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} className="flex-row items-center gap-3">
          <Skeleton className="aspect-[2/3] w-14 rounded-md" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </View>
        </View>
      ))}
    </View>
  );
}

function SearchHint({ onManual }: { onManual(): void }) {
  return (
    <View className="items-center gap-4 px-8 py-12">
      <View className="size-14 items-center justify-center rounded-full bg-muted">
        <Icon as={Search} size={26} className="text-muted-foreground" />
      </View>
      <View className="items-center gap-1.5">
        <Text className="text-center text-lg font-semibold">Find a book</Text>
        <Text className="max-w-sm text-center text-sm leading-5 text-muted-foreground">
          Search millions of books by title or author. Different editions and translations are the
          same book here.
        </Text>
      </View>
      <Button variant="ghost" size="sm" onPress={onManual}>
        <Icon as={PenLine} size={14} />
        <Text>Or type in the details yourself</Text>
      </Button>
    </View>
  );
}
