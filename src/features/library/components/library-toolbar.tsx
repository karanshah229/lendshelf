import { router } from 'expo-router';
import { FolderCog, LayoutGrid, List, Lock, Search, X } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  ALL_SHELVES,
  type LibraryCounts,
  type QuickFilter,
  type ShelfFilter,
} from '@/features/library/filter';
import { cn } from '@/lib/utils';
import type { Shelf, WithId } from '@/types/model';

import { Chip } from './chip';

export type LibraryView = 'grid' | 'list';

export interface LibraryToolbarProps {
  shelves: WithId<Shelf>[];
  shelfId: ShelfFilter;
  onShelfChange(id: ShelfFilter): void;
  totalCount: number;
  counts: LibraryCounts;
  filter: QuickFilter;
  onFilterChange(f: QuickFilter): void;
  query: string;
  onQueryChange(q: string): void;
  view: LibraryView;
  onViewChange(v: LibraryView): void;
}

/** Collection switcher, search, quick filters and the grid/list toggle above My books. */
export function LibraryToolbar({
  shelves,
  shelfId,
  onShelfChange,
  totalCount,
  counts,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  view,
  onViewChange,
}: LibraryToolbarProps) {
  return (
    <View className="gap-3 pb-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4"
        keyboardShouldPersistTaps="handled"
      >
        <Chip
          label="All"
          count={totalCount}
          selected={shelfId === ALL_SHELVES}
          onPress={() => onShelfChange(ALL_SHELVES)}
        />
        {shelves.map((s) => (
          <Chip
            key={s.id}
            label={s.name}
            icon={s.isPublic ? undefined : Lock}
            count={counts.byShelf[s.id] ?? 0}
            selected={shelfId === s.id}
            onPress={() => onShelfChange(s.id)}
            accessibilityLabel={`${s.name}${s.isPublic ? '' : ', private'}`}
          />
        ))}
        <Chip
          label="Manage"
          icon={FolderCog}
          onPress={() => router.push('/shelves')}
          className="border-dashed"
          accessibilityLabel="Manage collections"
        />
      </ScrollView>

      {/* The view toggle sits next to search so the status chips fit on one row at 375 px. */}
      <View className="flex-row items-center gap-2 px-4">
        <View className="relative flex-1 justify-center">
          <View className="absolute left-3 z-10" pointerEvents="none">
            <Icon as={Search} size={16} className="text-muted-foreground" />
          </View>
          <Input
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search your books"
            className="pl-9 pr-9"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search your books"
          />
          {query ? (
            <Pressable
              onPress={() => onQueryChange('')}
              className="absolute right-1 size-8 items-center justify-center rounded-full active:bg-accent"
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Pressable>
          ) : null}
        </View>
        <View className="h-10 flex-row rounded-md border border-border p-0.5">
          {(
            [
              { value: 'grid', icon: LayoutGrid, label: 'Grid view' },
              { value: 'list', icon: List, label: 'List view' },
            ] as const
          ).map((o) => (
            <Pressable
              key={o.value}
              onPress={() => onViewChange(o.value)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: view === o.value }}
              // 36 dp segment, 48 dp touch target (F8).
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              className={cn(
                'w-9 items-center justify-center rounded-sm',
                view === o.value && 'bg-accent'
              )}
            >
              <Icon
                as={o.icon}
                size={16}
                className={view === o.value ? 'text-foreground' : 'text-muted-foreground'}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <View className="flex-row items-center px-4">
        {/* One row (D4); scrolls sideways only when large fonts make it wider than the screen. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-1"
          contentContainerClassName="gap-2"
          keyboardShouldPersistTaps="handled"
        >
          <Chip label="All" selected={filter === 'all'} onPress={() => onFilterChange('all')} />
          <Chip
            label="Out"
            count={counts.lent}
            selected={filter === 'lent'}
            onPress={() => onFilterChange('lent')}
          />
          <Chip
            label="Not lending"
            count={counts.notLending}
            selected={filter === 'notLending'}
            onPress={() => onFilterChange('notLending')}
          />
          <Chip
            label="Hidden"
            count={counts.hidden}
            selected={filter === 'hidden'}
            onPress={() => onFilterChange('hidden')}
          />
        </ScrollView>
      </View>
    </View>
  );
}
