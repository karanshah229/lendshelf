import { router } from 'expo-router';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  History,
  PackageCheck,
  Send,
  UserPlus,
  MessageCircle,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { EmptyState, LoadErrorState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  filterHistory,
  loanStatusLabel,
  openRowLine,
  recentLine,
  requestRowLine,
  type HistoryFilter,
} from '@/features/loans/buckets';
import { loansEmptyCopy, type LoansEmptyAction } from '@/features/first-run/first-run';
import { goFindABook } from '@/features/home/search-focus';
import { useInvite } from '@/features/invite/use-invite';
import { useLoanSheets } from '@/features/loans/loan-sheets';
import { notBackYetReplyMessage, openWhatsApp } from '@/features/loans/messages';
import { NeedsYouList, openLoan } from '@/features/loans/needs-you-card';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import { useNeedsYou } from '@/features/loans/use-needs-you';
import { backAroundFor } from '@/features/loans/requests';
import { shortName } from '@/features/shared/people';
import { useItem, useMyItems } from '@/hooks/use-items';
import { useLinks } from '@/hooks/use-links';
import { useMyLoans } from '@/hooks/use-loans';
import { useWatches } from '@/hooks/use-watches';
import { formatShortDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Loan, WithId } from '@/types/model';

type L = WithId<Loan>;

const HISTORY_PAGE = 15;
const HISTORY_FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'lent', label: 'Lent' },
  { value: 'borrowed', label: 'Borrowed' },
  { value: 'requests', label: 'Requests' },
];

function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <View className="flex-row items-center gap-2 px-1 pb-1 pt-4" accessibilityRole="header">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </Text>
      {count ? <Text className="text-xs text-muted-foreground">({count})</Text> : null}
    </View>
  );
}

/**
 * Loans: one scroll sorted by who has to act (UX §D4). Needs you · Out with friends · With you ·
 * Your requests · Recent · History. Every row opens the Loan screen.
 */
export default function LoansScreen() {
  const { uid, cards, ledger, loading, error, retry, now, asOwner, asBorrower } = useNeedsYou();
  const allLoans = useMemo(() => [...asOwner, ...asBorrower], [asOwner, asBorrower]);
  const people = useLoanPeople(allLoans);
  const sheets = useLoanSheets();

  const header = (
    <ScreenHeader
      large
      title="Loans"
      right={
        <Button
          variant="outline"
          className="min-h-11"
          onPress={() => router.push('/pick-copy')}
          accessibilityLabel="Lend a book"
        >
          <Icon as={Send} size={15} />
          <Text>Lend a book</Text>
        </Button>
      }
    />
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </View>
    );
  } else if (error) {
    body = <LoadErrorState title="Couldn’t load your loans" onRetry={retry} />;
  } else {
    const { outWithFriends, withYou, yourRequests, recent, history } = ledger;
    const empty =
      !cards.length &&
      !outWithFriends.length &&
      !withYou.length &&
      !yourRequests.length &&
      !history.length;
    body = empty ? (
      <LoansEmpty />
    ) : (
      <View>
        {cards.length ? <SectionTitle count={cards.length}>Needs you</SectionTitle> : null}
        {/* Always mounted: its sheets (e.g. the accept success sheet) outlive the last card. */}
        <NeedsYouList cards={cards} />

        {outWithFriends.length ? (
          <>
            <SectionTitle count={outWithFriends.length}>Out with friends</SectionTitle>
            <View className="gap-1">
              {outWithFriends.map((l) => {
                const line = openRowLine(l, uid, people.name(l), now);
                return (
                  <LedgerRow
                    key={l.id}
                    loan={l}
                    line={line.text}
                    danger={line.overdue}
                    trailing={
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={sheets.busyId === l.id}
                        onPress={() => sheets.confirm('gotItBack', l)}
                        accessibilityLabel={`Got ${l.title} back`}
                      >
                        <Icon as={PackageCheck} size={14} />
                        <Text>Got it back</Text>
                      </Button>
                    }
                  />
                );
              })}
            </View>
          </>
        ) : null}

        {withYou.length ? (
          <>
            <SectionTitle count={withYou.length}>With you</SectionTitle>
            <View className="gap-1">
              {withYou.map((l) => {
                const line = openRowLine(l, uid, people.name(l), now);
                const phone = people.phone(l);
                // QA B1: after "Not back yet", the row offers the WhatsApp reply (E4).
                const notBack = l.status === 'active' && !!l.notBackYetAt && !!phone;
                return (
                  <LedgerRow
                    key={l.id}
                    loan={l}
                    line={line.text}
                    danger={line.overdue}
                    muted={l.status === 'returnPending'}
                    trailing={
                      notBack ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          onPress={() =>
                            void openWhatsApp(
                              phone,
                              notBackYetReplyMessage({
                                ownerName: people.greetName(l),
                                title: l.title,
                              })
                            )
                          }
                          accessibilityLabel={`Message ${shortName(people.name(l))} on WhatsApp`}
                        >
                          <Icon as={MessageCircle} size={14} />
                          <Text>Message</Text>
                        </Button>
                      ) : undefined
                    }
                  />
                );
              })}
            </View>
          </>
        ) : null}

        {yourRequests.length ? (
          <>
            <SectionTitle count={yourRequests.length}>Your requests</SectionTitle>
            <View className="gap-1">
              {yourRequests.map((l) => (
                <LedgerRow key={l.id} loan={l} line={requestRowLine(l, people.name(l), now)} />
              ))}
            </View>
          </>
        ) : null}

        {recent.length ? (
          <>
            <SectionTitle>Recent</SectionTitle>
            <View className="gap-1">
              {recent.map((l) => (
                <RecentRow key={l.id} loan={l} uid={uid} name={people.name(l)} now={now} />
              ))}
            </View>
          </>
        ) : null}

        <HistorySection loans={history} uid={uid} name={people.name} />
      </View>
    );
  }

  return (
    <Screen safeBottom={false} header={header} className="pt-0">
      {body}
      {sheets.element}
    </Screen>
  );
}

/**
 * No loans yet (E2a): one primary chosen by the user's situation: Find a book when friends are
 * on LendShelf, else Add your books or Lend a book; Invite friends while the circle is empty.
 */
function LoansEmpty() {
  const { links, loading: linksLoading } = useLinks();
  const { items, loading: itemsLoading } = useMyItems();
  const invite = useInvite();
  if (linksLoading || itemsLoading) return null;
  const copy = loansEmptyCopy({ hasPeople: links.length > 0, hasBooks: items.length > 0 });
  const go: Record<LoansEmptyAction, () => void> = {
    findBook: goFindABook,
    addBooks: () => router.push('/add'),
    lend: () => router.push('/pick-copy'),
  };
  return (
    <EmptyState icon={ArrowLeftRight} title={copy.title} description={copy.body} className="py-10">
      <Button className="min-h-12" onPress={go[copy.primary.action]}>
        <Text>{copy.primary.label}</Text>
      </Button>
      {links.length === 0 ? (
        <Button variant="outline" className="min-h-12" onPress={() => void invite()}>
          <Icon as={UserPlus} size={16} />
          <Text>Invite friends</Text>
        </Button>
      ) : null}
    </EmptyState>
  );
}

function LedgerRow({
  loan,
  line,
  danger,
  muted,
  note,
  badge,
  badgeTone = 'outline',
  trailing,
}: {
  loan: L;
  line: string;
  danger?: boolean;
  muted?: boolean;
  note?: string | null;
  badge?: string;
  badgeTone?: 'outline' | 'success' | 'warning';
  trailing?: ReactNode;
}) {
  return (
    <View className={cn('flex-row items-center gap-2 rounded-lg', muted && 'opacity-60')}>
      <Pressable
        onPress={() => openLoan(loan.id)}
        accessibilityRole="button"
        // Everything the row shows, in words: status, note and badge (F8).
        accessibilityLabel={[loan.title, line, note, badge].filter(Boolean).join(', ')}
        accessibilityHint="Opens the loan"
        className="min-h-12 flex-1 flex-row items-center gap-3 rounded-lg px-1 py-2 active:bg-accent"
      >
        <BookCover uri={loan.coverUrl} title={loan.title} size="xs" />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold" numberOfLines={2}>
            {loan.title}
          </Text>
          <Text
            className={cn(
              'text-xs',
              danger ? 'font-medium text-destructive' : 'text-muted-foreground'
            )}
          >
            {line}
          </Text>
          {note ? <Text className="text-xs text-muted-foreground">{note}</Text> : null}
        </View>
        {badge ? (
          <Badge variant={badgeTone}>
            <Text>{badge}</Text>
          </Badge>
        ) : null}
      </Pressable>
      {trailing}
    </View>
  );
}

/**
 * A Recent row. For my request that was "Lent to someone else" it reads the copy (when I still
 * can) for "back around 12 Dec", and says "We'll tell you when it's back" (E4, E5).
 */
function RecentRow({ loan, uid, name, now }: { loan: L; uid: string; name: string; now: Date }) {
  const lentElsewhere =
    loan.ownerId !== uid &&
    loan.status === 'declined' &&
    loan.declineReason === 'lentToSomeoneElse';
  const { item } = useItem(lentElsewhere ? loan.itemId : null);
  const { isWatchingBack } = useWatches();
  const { asBorrower } = useMyLoans();
  const backAround = backAroundFor(item, new Set(asBorrower.map((l) => l.id)));
  return (
    <LedgerRow
      loan={loan}
      line={recentLine(loan, uid, name, { now, backAround })}
      note={
        loan.status === 'ownerLeft'
          ? 'If you still have it, message them on WhatsApp if you still have their number.'
          : lentElsewhere && isWatchingBack(loan.itemId)
            ? 'We’ll tell you when it’s back'
            : null
      }
      badge={lentElsewhere ? undefined : loanStatusLabel(loan)}
      badgeTone={
        loan.status === 'returned' ? 'success' : loan.status === 'ownerLeft' ? 'warning' : 'outline'
      }
    />
  );
}

function HistorySection({ loans, uid, name }: { loans: L[]; uid: string; name(l: L): string }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [shown, setShown] = useState(HISTORY_PAGE);
  if (!loans.length) return null;
  const filtered = filterHistory(loans, filter, uid);

  return (
    <View className="mt-5 overflow-hidden rounded-xl border border-border">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`History, ${loans.length} closed loans`}
        className="min-h-12 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
      >
        <Icon as={History} size={16} className="text-muted-foreground" />
        <Text className="flex-1 text-sm font-medium">History</Text>
        <Text className="text-xs text-muted-foreground">{loans.length}</Text>
        <Icon as={open ? ChevronUp : ChevronDown} size={16} className="text-muted-foreground" />
      </Pressable>
      {open ? (
        <View className="gap-1 border-t border-border px-3 py-2">
          <View className="flex-row flex-wrap gap-2 pb-1" accessibilityRole="tablist">
            {HISTORY_FILTERS.map((f) => {
              const selected = f.value === filter;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => {
                    setFilter(f.value);
                    setShown(HISTORY_PAGE);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  // 32 dp chip, 48 dp touch target (F8).
                  hitSlop={{ top: 8, bottom: 8 }}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5',
                    selected
                      ? 'border-primary bg-primary'
                      : 'border-border bg-background active:bg-accent'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      selected ? 'text-primary-foreground' : 'text-foreground'
                    )}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {filtered.length ? null : (
            <Text className="py-3 text-center text-sm text-muted-foreground">
              Nothing here yet.
            </Text>
          )}
          {filtered.slice(0, shown).map((l) => {
            const when = l.returnedAt ?? l.updatedAt;
            return (
              <LedgerRow
                key={l.id}
                loan={l}
                line={[recentLine(l, uid, name(l)), when ? formatShortDate(when) : null]
                  .filter(Boolean)
                  .join(' · ')}
                badge={loanStatusLabel(l)}
                badgeTone={l.status === 'returned' ? 'success' : 'outline'}
              />
            );
          })}
          {filtered.length > shown ? (
            <Button
              variant="ghost"
              className="min-h-11"
              onPress={() => setShown((n) => n + HISTORY_PAGE)}
            >
              <Text>Show more</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
