/**
 * Home feed when not searching (D4 Home, C8): your circle, From your wishlist, New this week
 * (grouped by person), Available to borrow, Popular in your circle. Every section is hidden
 * when empty.
 */
import { router } from 'expo-router';
import { ChevronDown, ChevronUp, MessageCircle, UserPlus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { BookRow } from '@/components/book-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { LinkedOwner } from '@/hooks/use-links';
import { useMyLoans } from '@/hooks/use-loans';
import { useWatches } from '@/hooks/use-watches';
import { useContactsStore } from '@/stores/contacts';
import type { Item, WithId } from '@/types/model';

import { newOnLendShelf } from '@/features/contacts/resync';
import { useInvite } from '@/features/invite/use-invite';
import { useNow } from '@/features/loans/use-needs-you';
import { joinNames, shortName, shortNames } from '@/features/shared/people';
import { openWhatsApp, requestFollowUpMessage } from '@/features/loans/messages';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import { circleCopiesForBook, summarizeCircleCopies } from '@/features/book/circle-copies';
import { AskDialog, type AskTarget } from '@/features/copy/AskDialog';
import {
  availableToBorrow,
  countByOwner,
  newByPerson,
  POPULAR_MIN_ENTRIES,
  popularInCircle,
  type PersonNew,
} from '@/features/discover/highlights';
import { CoverCard } from '@/features/shared/CoverCard';
import { CircleReading } from '@/features/reading/CircleReading';
import { PersonAvatar, SectionHeader } from '@/features/shared/ui';
import { wishlistAvailability, wishlistAvailableNow } from '@/features/wishlist/availability';
import { AvailabilityLine } from '@/features/wishlist/AvailabilityLine';

interface SentRequest {
  loanId: string;
  target: AskTarget;
}

/**
 * "Request sent" receipts for asks made from Home (QA B4, E4 step 3, F7): the copy leaves
 * Available to borrow once requested, so the receipt stays here instead, with "Message Ravi
 * again" for anyone who backed out of WhatsApp. It goes once the request is answered (a
 * Needs-you card or Loans takes over) or when dismissed.
 */
function RequestReceipts({
  sent,
  onDismiss,
}: {
  sent: readonly SentRequest[];
  onDismiss(loanId: string): void;
}) {
  const { asBorrower } = useMyLoans();
  const live = sent.map((x) => ({ ...x, loan: asBorrower.find((l) => l.id === x.loanId) }));
  // Until the listener has it, the request is pending; afterwards only while still requested.
  const open = live.filter((x) => !x.loan || x.loan.status === 'requested');
  const people = useLoanPeople(open.flatMap((x) => (x.loan ? [x.loan] : [])));
  if (!open.length) return null;
  return (
    <View className="gap-2">
      {open.map(({ loanId, target, loan }) => {
        const owner = shortName(target.ownerName) || target.ownerName;
        const phone = loan ? people.phone(loan) : null;
        const greet = loan ? people.greetName(loan) : null;
        return (
          <Card key={loanId} className="flex-row gap-3 px-3 py-3">
            <BookCover uri={target.coverUrl} title={target.title} size="xs" />
            <View className="flex-1 gap-1">
              <View accessible accessibilityRole="header" accessibilityLiveRegion="polite">
                <Text className="text-[15px] font-semibold leading-5">
                  Request sent · {target.title}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {owner} can answer in LendShelf
                </Text>
              </View>
              <View className="flex-row flex-wrap items-center gap-2 pt-1">
                {phone ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onPress={() =>
                      void openWhatsApp(phone, requestFollowUpMessage(greet, target.title))
                    }
                  >
                    <Icon as={MessageCircle} size={14} />
                    <Text>Message {owner} again</Text>
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onPress={() => router.push({ pathname: '/loan/[loanId]', params: { loanId } })}
                >
                  <Text>Open request</Text>
                </Button>
              </View>
            </View>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              onPress={() => onDismiss(loanId)}
              accessibilityLabel={`Hide the receipt for ${target.title}`}
            >
              <Icon as={X} size={16} className="text-muted-foreground" />
            </Button>
          </Card>
        );
      })}
    </View>
  );
}

/**
 * The People row (D4, C10): avatars by book count, people found by the latest contacts sync
 * marked "New on LendShelf" (E13), and a trailing "+ Invite" (E2).
 */
function CircleRow({ links, counts }: { links: LinkedOwner[]; counts: Map<string, number> }) {
  const invite = useInvite();
  const newOwnerIds = useContactsStore((s) => s.newOwnerIds);
  const lastSyncedAt = useContactsStore((s) => s.lastSyncedAt);
  const now = useNow();
  const fresh = useMemo(
    () => newOnLendShelf({ newOwnerIds, lastSyncedAt, now: now.getTime() }),
    [newOwnerIds, lastSyncedAt, now]
  );
  const people = useMemo(
    () =>
      [...links].sort(
        (a, b) =>
          // New people first, so the chip is next to them.
          Number(fresh.has(b.ownerId)) - Number(fresh.has(a.ownerId)) ||
          (counts.get(b.ownerId) ?? 0) - (counts.get(a.ownerId) ?? 0)
      ),
    [links, counts, fresh]
  );
  const newNames = people.filter((p) => fresh.has(p.ownerId)).map((p) => p.displayName);
  // Kept apart from each other: two friends never share a label (QA Android #4).
  const labels = shortNames(people.map((p) => p.displayName));
  return (
    <View>
      <SectionHeader
        title="Your circle"
        description={`${links.length} ${links.length === 1 ? 'friend' : 'friends'} on LendShelf`}
      />
      {newNames.length ? (
        <View className="flex-row pb-3">
          <Badge variant="secondary">
            <Text>New on LendShelf: {joinNames(shortNames(newNames))}</Text>
          </Badge>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-1"
        className="-mx-4"
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {people.map((p, i) => {
          const n = counts.get(p.ownerId) ?? 0;
          return (
            <Pressable
              key={p.ownerId}
              onPress={() => router.push({ pathname: '/person/[uid]', params: { uid: p.ownerId } })}
              className="w-[72px] items-center gap-1.5 active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel={`${p.displayName}, ${n} books${fresh.has(p.ownerId) ? ', new on LendShelf' : ''}`}
            >
              <PersonAvatar
                name={p.displayName}
                size="lg"
                className={fresh.has(p.ownerId) ? 'border-2 border-primary' : undefined}
              />
              <Text className="text-center text-xs font-medium" numberOfLines={2}>
                {labels[i] || p.displayName}
              </Text>
              <Text className="-mt-1 text-[10px] text-muted-foreground">
                {n} {n === 1 ? 'book' : 'books'}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => void invite()}
          className="w-[72px] items-center gap-1.5 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Invite friends to LendShelf"
        >
          <View className="size-16 items-center justify-center rounded-full border border-dashed border-border">
            <Icon as={UserPlus} size={22} className="text-muted-foreground" />
          </View>
          <Text className="text-center text-xs font-medium">+ Invite</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** "Kabir added 12 books": one card per person with up to 3 covers; tap to see them all. */
function NewFromPerson({
  group,
  name,
  requestedItemIds,
  borrowedItemIds,
}: {
  group: PersonNew<WithId<Item>>;
  name: string;
  requestedItemIds: ReadonlySet<string>;
  borrowedItemIds: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const n = group.items.length;
  const title = `${shortName(name) || name} added ${n === 1 ? group.items[0]!.title : `${n} books`}`;
  return (
    <Card className="gap-0 py-0">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-accent"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${name} added ${n} ${n === 1 ? 'book' : 'books'}`}
        accessibilityHint={open ? 'Hides the books' : 'Shows the books'}
      >
        <PersonAvatar name={name} size="md" />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-medium" numberOfLines={2}>
            {title}
          </Text>
          {open ? null : (
            <View className="flex-row gap-1.5 pt-1">
              {group.items.slice(0, 3).map((item) => (
                <BookCover key={item.id} uri={item.coverUrl} title={item.title} size="xs" />
              ))}
            </View>
          )}
        </View>
        <Icon as={open ? ChevronUp : ChevronDown} size={18} className="text-muted-foreground" />
      </Pressable>
      {open ? (
        <View className="-mx-1.5 flex-row flex-wrap px-4 pb-2">
          {group.items.map((item) => (
            <View key={item.id} className="mb-4 w-1/3 px-1.5">
              <CoverCard
                item={item}
                requestedByMe={requestedItemIds.has(item.id)}
                borrowedByMe={borrowedItemIds.has(item.id)}
              />
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function DiscoverHome({
  uid,
  links,
  items,
  networkItems,
  requestedItemIds,
  borrowedItemIds,
  nameOf,
}: {
  uid: string;
  links: LinkedOwner[];
  /** Mine + network. */
  items: WithId<Item>[];
  networkItems: WithId<Item>[];
  requestedItemIds: ReadonlySet<string>;
  /** Copies I'm borrowing right now ("With you"). */
  borrowedItemIds: ReadonlySet<string>;
  nameOf(uid: string): string;
}) {
  const { wishlist } = useWatches();
  const [askTarget, setAskTarget] = useState<AskTarget | null>(null);
  /** QA B4 / E4 step 3: requests sent from Home, shown as a receipt where I asked. */
  const [sent, setSent] = useState<SentRequest[]>([]);
  const ask = (item: WithId<Item>) =>
    setAskTarget({
      itemId: item.id,
      title: item.title,
      coverUrl: item.coverUrl,
      ownerName: nameOf(item.ownerId),
      ownerId: item.ownerId,
    });

  const myItems = useMemo(() => items.filter((i) => i.ownerId === uid), [items, uid]);
  const counts = useMemo(() => countByOwner(networkItems), [networkItems]);
  const fromWishlist = useMemo(
    () => wishlistAvailableNow(wishlist, items, { uid, requestedItemIds, borrowedItemIds, nameOf }),
    [wishlist, items, uid, requestedItemIds, borrowedItemIds, nameOf]
  );
  const fresh = useMemo(() => newByPerson(networkItems), [networkItems]);
  const available = useMemo(
    () =>
      availableToBorrow(networkItems, {
        // Books already on the feed (New this week, From your wishlist) aren't repeated.
        // Nor books I own myself (QA friction: Popular already excluded them).
        exclude: [
          ...fresh.flatMap((g) => g.items),
          ...fromWishlist.map((m) => m.best.item),
          ...myItems,
        ],
        requestedItemIds,
        borrowedItemIds,
      }),
    [networkItems, fresh, fromWishlist, myItems, requestedItemIds, borrowedItemIds]
  );
  const popular = useMemo(() => {
    const list = popularInCircle(networkItems, { limit: 6, exclude: myItems });
    return list.length >= POPULAR_MIN_ENTRIES ? list : [];
  }, [networkItems, myItems]);

  return (
    <View className="gap-8">
      <RequestReceipts
        sent={sent}
        onDismiss={(loanId) => setSent((list) => list.filter((x) => x.loanId !== loanId))}
      />
      <CircleRow links={links} counts={counts} />

      {fromWishlist.length ? (
        <View>
          <SectionHeader
            title="From your wishlist"
            description="Books you want that a friend can lend now"
          />
          <View className="gap-1">
            {fromWishlist.map((m) => (
              <View key={m.workId} className="flex-row items-center gap-2">
                <View className="flex-1">
                  <BookRow
                    title={m.best.item.title}
                    authors={m.best.item.authors}
                    coverUrl={m.best.item.coverUrl}
                    href={{ pathname: '/book/[workId]', params: { workId: m.workId } }}
                    meta={
                      <AvailabilityLine availability={wishlistAvailability(m.summary, nameOf)} />
                    }
                  />
                </View>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => ask(m.best.item)}
                  hitSlop={8}
                  accessibilityLabel={`Ask ${nameOf(m.best.item.ownerId)} for ${m.best.item.title}`}
                >
                  <Text>Ask</Text>
                </Button>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {fresh.length ? (
        <View>
          <SectionHeader title="New this week" />
          <View className="gap-2">
            {fresh.map((g) => (
              <NewFromPerson
                key={g.ownerId}
                group={g}
                name={nameOf(g.ownerId)}
                requestedItemIds={requestedItemIds}
                borrowedItemIds={borrowedItemIds}
              />
            ))}
          </View>
        </View>
      ) : null}

      <CircleReading uid={uid} nameOf={nameOf} />

      {available.length ? (
        <View>
          <SectionHeader title="Available to borrow" description="Ready now from your circle" />
          <View className="-mx-1.5 flex-row flex-wrap">
            {available.map((item) => (
              <View key={item.id} className="mb-4 w-1/3 justify-between gap-1.5 px-1.5">
                <CoverCard item={item} subtitle={nameOf(item.ownerId)} />
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => ask(item)}
                  hitSlop={6}
                  accessibilityLabel={`Ask ${nameOf(item.ownerId)} for ${item.title}`}
                >
                  <Text>Ask</Text>
                </Button>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {popular.length ? (
        <View>
          <SectionHeader
            title="Popular in your circle"
            description="Books several friends own that you don’t"
          />
          <View className="gap-1">
            {popular.map((p) => {
              const summary = summarizeCircleCopies(
                circleCopiesForBook(p.workId, null, p.copies, {
                  uid,
                  requestedItemIds,
                  borrowedItemIds,
                })
              );
              return (
                <BookRow
                  key={p.workId}
                  title={p.title}
                  authors={p.authors}
                  coverUrl={p.copies.find((c) => c.coverUrl)?.coverUrl}
                  href={{ pathname: '/book/[workId]', params: { workId: p.workId } }}
                  meta={`${p.ownerCount} friends have it${summary.availableCount ? ` · ${summary.availableCount} available` : ''}`}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      <AskDialog
        target={askTarget}
        onOpenChange={(open) => !open && setAskTarget(null)}
        onSent={(loanId) => {
          const target = askTarget;
          if (!target) return;
          setSent((list) => [{ loanId, target }, ...list.filter((x) => x.loanId !== loanId)]);
        }}
      />
    </View>
  );
}
