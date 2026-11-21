import { router } from 'expo-router';
import { BookPlus, Globe, Heart, Search, UserPlus, Users, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';

import { BookRow } from '@/components/book-row';
import { EmptyState, LoadErrorState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useMyProfile, useUid } from '@/hooks/use-auth';
import { useMyItems } from '@/hooks/use-items';
import { useLinks } from '@/hooks/use-links';
import { HAS_ADDRESS_BOOK } from '@/lib/contacts';
import { searchBooks } from '@/lib/search';
import { useContactsStore } from '@/stores/contacts';
import { useDismissedStore } from '@/stores/dismissed';

import { rankCircleCopies, summarizeCircleCopies } from '@/features/book/circle-copies';
import { CatalogueResults } from '@/features/discover/CatalogueResults';
import { DiscoverHome } from '@/features/discover/DiscoverHome';
import { CATALOGUE_MIN_LENGTH } from '@/features/discover/use-catalogue-search';
import { openContactsSettings } from '@/features/contacts/use-auto-resync';
import { firstRunCase, setupCopy } from '@/features/first-run/first-run';
import { setupCardState } from '@/features/home/home';
import { useHomeSearchFocus } from '@/features/home/search-focus';
import { useInvite } from '@/features/invite/use-invite';
import { HomeNeedsYou } from '@/features/home/needs-you';
import { SETUP_DISMISS_KEY, SetupCard } from '@/features/home/setup-card';
import { StatusStrip } from '@/features/home/status-strip';
import { useNeedsYou } from '@/features/loans/use-needs-you';
import {
  useBorrowedItemIds,
  useCircleItems,
  useNameOf,
  useRequestedItemIds,
} from '@/features/shared/hooks';
import { BookRowSkeletons, SectionHeader } from '@/features/shared/ui';
import { wishlistAvailability } from '@/features/wishlist/availability';
import { AvailabilityLine } from '@/features/wishlist/AvailabilityLine';

/**
 * Home (UX §D4, C7): search, then Needs you (at most 2 cards + "See all n in Loans"), the status
 * strip, the setup card (hidden while Needs you has cards) and the discovery feed. Search covers
 * your circle's books, or the catalogue when nothing matches.
 */
export default function HomeScreen() {
  const uid = useUid();
  const { cards, ledger, now, loading: loansLoading } = useNeedsYou();
  const { profile } = useMyProfile();
  const { items: myItems, loading: myItemsLoading } = useMyItems();
  const setupDismissed = useDismissedStore((s) => s.keys.includes(SETUP_DISMISS_KEY));
  const contactsPermission = useContactsStore((s) => s.permission);
  const syncError = useContactsStore((s) => s.syncError);
  const invite = useInvite();
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null);
  // "Find a book" from Loans' empty state lands here with the cursor in search (E2a ii).
  const focusToken = useHomeSearchFocus((s) => s.token);
  useEffect(() => {
    if (focusToken) setTimeout(() => searchRef.current?.focus(), 50);
  }, [focusToken]);
  const [q, setQ] = useState('');
  const [showCatalogue, setShowCatalogue] = useState(false);
  const { links, loading: linksLoading } = useLinks();
  const { items, networkItems, loading, error, retry } = useCircleItems();
  const requestedItemIds = useRequestedItemIds();
  const borrowedItemIds = useBorrowedItemIds();
  const nameOf = useNameOf();

  const searching = q.trim().length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    // Copies of one book filed under different catalogue records are one row ("2 editions").
    return searchBooks(items, q).map((g) => {
      const ranked = rankCircleCopies(g.copies, {
        uid,
        requestedItemIds,
        borrowedItemIds,
        nameOf,
      });
      const summary = summarizeCircleCopies(ranked);
      return {
        group: g,
        summary,
        availability: wishlistAvailability(summary, nameOf),
        coverUrl: g.copies.find((c) => c.coverUrl)?.coverUrl ?? null,
      };
    });
  }, [items, q, searching, uid, requestedItemIds, borrowedItemIds, nameOf]);

  const onChangeQuery = (text: string) => {
    setQ(text);
    if (!text.trim()) setShowCatalogue(false);
  };

  const setup =
    linksLoading || myItemsLoading || loansLoading
      ? null
      : setupCardState({
          hasPeople: links.length > 0,
          hasBooks: myItems.length > 0,
          hasPickup: !!profile?.pickupNote?.trim(),
          dismissed: setupDismissed,
          needsYouCount: cards.length,
        });
  // E2a: nobody found yet (i), people found (ii), or contacts off (iii).
  const firstRun = firstRunCase({
    hasAddressBook: HAS_ADDRESS_BOOK,
    permission: contactsPermission,
    peopleCount: links.length,
  });
  const setupText = setupCopy({
    case: firstRun,
    permission: contactsPermission,
    syncFailed: !!syncError,
  });
  const setupCard = setup ? (
    <SetupCard
      state={setup}
      copy={setupText}
      friendNames={links.map((l) => l.displayName)}
      profileName={profile?.name ?? ''}
      pickupNote={profile?.pickupNote ?? null}
    />
  ) : null;

  const catalogueVisible =
    searching &&
    q.trim().length >= CATALOGUE_MIN_LENGTH &&
    (showCatalogue || (!loading && results.length === 0));

  return (
    <Screen
      safeBottom={false}
      header={
        <ScreenHeader
          large
          title="Home"
          className="pb-1"
          right={
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              onPress={() => router.push('/wishlist')}
              accessibilityLabel="Wishlist"
              hitSlop={4}
            >
              <Icon as={Heart} size={20} />
            </Button>
          }
        />
      }
    >
      <View className="w-full max-w-2xl self-center">
        <View className="relative mb-4 justify-center">
          <Icon as={Search} size={18} className="absolute left-3 z-10 text-muted-foreground" />
          <Input
            // The ui Input types its ref as the component, not the instance: hand it over untyped.
            ref={(el: unknown) => {
              searchRef.current = el as ComponentRef<typeof TextInput> | null;
            }}
            value={q}
            onChangeText={onChangeQuery}
            placeholder="Does anyone have…?"
            className="h-11 pl-10 pr-10"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Does anyone have…? Search by title or author"
          />
          {searching ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 rounded-full"
              onPress={() => onChangeQuery('')}
              accessibilityLabel="Clear search"
            >
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Button>
          ) : null}
        </View>

        {/* Reading order (F8): Needs you → status strip → setup card → feed. */}
        <HomeNeedsYou cards={cards} hidden={searching} />
        {searching ? null : (
          <StatusStrip
            outWithFriends={ledger.outWithFriends}
            withYou={ledger.withYou}
            now={now}
            className={cards.length ? 'mt-1' : undefined}
          />
        )}
        {/* Space before the feed only when the top section shows something. */}
        {!searching && (cards.length || ledger.outWithFriends.length || ledger.withYou.length) ? (
          <View className="h-6" />
        ) : null}

        {searching ? (
          <View className="gap-8">
            {loading ? (
              <BookRowSkeletons count={3} />
            ) : error && !results.length ? (
              <LoadErrorState
                title="Couldn’t search your circle"
                onRetry={retry}
                className="py-6"
              />
            ) : results.length ? (
              <View>
                <SectionHeader
                  title="In your circle"
                  description={`${results.length} ${results.length === 1 ? 'book' : 'books'}`}
                />
                <View className="gap-1">
                  {results.map(({ group, summary, availability, coverUrl }) => (
                    <BookRow
                      key={group.workId}
                      title={group.title}
                      authors={group.authors}
                      coverUrl={coverUrl}
                      href={{ pathname: '/book/[workId]', params: { workId: group.workId } }}
                      meta={
                        // Only my copies: the "You own it" badge says it; skip the wishlist
                        // wording ("You own a copy now").
                        availability.tone === 'mine' ? undefined : (
                          <AvailabilityLine availability={availability} />
                        )
                      }
                      badge={
                        summary.mineCount || group.workIds.length > 1 ? (
                          <>
                            {summary.mineCount ? (
                              <Badge variant="outline">
                                <Text>You own it</Text>
                              </Badge>
                            ) : null}
                            {group.workIds.length > 1 ? (
                              <Badge variant="secondary">
                                <Text>{group.workIds.length} editions</Text>
                              </Badge>
                            ) : null}
                          </>
                        ) : undefined
                      }
                    />
                  ))}
                </View>
              </View>
            ) : (
              <Card className="flex-row items-center gap-3 px-4 py-4">
                <View className="size-10 items-center justify-center rounded-full bg-muted">
                  <Icon as={Search} size={18} className="text-muted-foreground" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold">No one in your circle has it</Text>
                  <Text className="text-sm text-muted-foreground">
                    {q.trim().length >= CATALOGUE_MIN_LENGTH
                      ? 'Here’s what the catalogue found instead.'
                      : 'Keep typing to search the catalogue.'}
                  </Text>
                </View>
              </Card>
            )}

            {catalogueVisible ? (
              <CatalogueResults query={q} />
            ) : !loading && results.length && q.trim().length >= CATALOGUE_MIN_LENGTH ? (
              <Button variant="outline" onPress={() => setShowCatalogue(true)}>
                <Icon as={Globe} size={16} />
                <Text>Search the catalogue for “{q.trim()}”</Text>
              </Button>
            ) : null}
          </View>
        ) : linksLoading || loading ? (
          <BookRowSkeletons count={4} />
        ) : links.length === 0 && setupCard ? (
          setupCard
        ) : links.length === 0 ? (
          // The setup card was dismissed or finished: same case copy, one primary (E2a).
          <EmptyState
            icon={Users}
            title={setupText.title ?? 'No one here yet'}
            description={setupText.body ?? undefined}
          >
            {setupText.peopleAction === 'invite' ? (
              <Button className="min-h-12" onPress={() => void invite()}>
                <Icon as={UserPlus} size={16} className="text-primary-foreground" />
                <Text>Invite friends</Text>
              </Button>
            ) : setupText.peopleAction === 'openSettings' ? (
              <Button className="min-h-12" onPress={openContactsSettings}>
                <Text>{setupText.peopleActionLabel}</Text>
              </Button>
            ) : (
              <Button className="min-h-12" onPress={() => router.push('/contacts')}>
                <Text>{setupText.peopleActionLabel}</Text>
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            {setupCard ? <View className="pb-8">{setupCard}</View> : null}
            <DiscoverHome
              uid={uid}
              links={links}
              items={items}
              networkItems={networkItems}
              requestedItemIds={requestedItemIds}
              borrowedItemIds={borrowedItemIds}
              nameOf={nameOf}
            />
            {error ? (
              <LoadErrorState
                title={
                  items.length ? 'Some books couldn’t load' : 'Couldn’t load your circle’s books'
                }
                onRetry={retry}
              />
            ) : networkItems.length === 0 ? (
              <EmptyState
                icon={BookPlus}
                title="Nothing shared yet"
                description="People you know haven’t shared any books yet. Add yours to get things going."
              >
                <Button onPress={() => router.push('/add')}>
                  <Text>Add a book</Text>
                </Button>
              </EmptyState>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
