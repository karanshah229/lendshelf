import { router, useLocalSearchParams } from 'expo-router';
import {
  BookX,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  Inbox,
  MessageCircle,
  UserX,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { canOpenCopy } from '@/features/loans/buckets';
import { useLoanSheets, WhatsAppButton } from '@/features/loans/loan-sheets';
import {
  actionLabel,
  loanTimeline,
  loanView,
  WHATSAPP_ACTIONS,
  type BannerTone,
  type LoanAction,
  type LoanView,
} from '@/features/loans/loan-view';
import {
  loanChatMessage,
  moreTimeMessage,
  notBackYetReplyMessage,
  notPickingUpMessage,
  nudgeLoanMessage,
  openWhatsApp,
  pickupBorrowerMessage,
  pickupOwnerMessage,
  requestFollowUpMessage,
  requestReplyMessage,
} from '@/features/loans/messages';
import { backAroundFor } from '@/features/loans/requests';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import { useNow } from '@/features/loans/use-needs-you';
import { StarPicker } from '@/features/reviews/Stars';
import { setWatchingBack, setWishlisted } from '@/features/shared/mutations';
import { PersonAvatar, SectionHeader } from '@/features/shared/ui';
import { useMyProfile } from '@/hooks/use-auth';
import { useItem } from '@/hooks/use-items';
import { useLinkMap } from '@/hooks/use-links';
import { useDocData } from '@/hooks/use-firestore';
import { useLoan, useMyLoans } from '@/hooks/use-loans';
import { useWatches } from '@/hooks/use-watches';
import { announce, sentences } from '@/lib/a11y';
import { dueLabel, formatLongDate, formatShortDate, isOverdue } from '@/lib/dates';
import { relativeDueHint } from '@/features/loans/due-dates';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session';
import { COLLECTIONS, reviewId, type Loan, type Review, type WithId } from '@/types/model';
import { shortName } from '@/features/shared/people';

type L = WithId<Loan>;

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const first = shortName;

const TONES: Record<BannerTone, { box: string; icon: string; Icon: LucideIcon }> = {
  action: {
    box: 'border-amber-500/50 bg-amber-500/10',
    icon: 'text-amber-700 dark:text-amber-400',
    Icon: Inbox,
  },
  warning: {
    box: 'border-amber-500/50 bg-amber-500/10',
    icon: 'text-amber-700 dark:text-amber-400',
    Icon: Clock,
  },
  danger: {
    box: 'border-destructive/40 bg-destructive/10',
    icon: 'text-destructive',
    Icon: CircleAlert,
  },
  info: {
    box: 'border-sky-500/40 bg-sky-500/10',
    icon: 'text-sky-700 dark:text-sky-400',
    Icon: Clock,
  },
  success: {
    box: 'border-emerald-500/40 bg-emerald-500/10',
    icon: 'text-emerald-700 dark:text-emerald-400',
    Icon: Check,
  },
  muted: { box: 'border-border bg-muted/50', icon: 'text-muted-foreground', Icon: Clock },
};

/** The Loan screen (UX §D4): state banner, other party, due date, note, timeline, review. */
export default function LoanScreen() {
  const { loanId, review } = useLocalSearchParams<{ loanId: string; review?: string }>();
  const { loan, loading, error } = useLoan(loanId);

  let body: ReactNode;
  if (loading) {
    body = (
      <View className="gap-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </View>
    );
  } else if (!loan || error) {
    body = (
      <EmptyState
        icon={BookX}
        title="This isn’t shared with you any more"
        description="The loan was removed, or you’re no longer part of it."
      >
        <Button
          variant="outline"
          className="min-h-11"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Text>Back</Text>
        </Button>
      </EmptyState>
    );
  } else {
    body = <LoanDetails loan={loan} focusReview={review === '1'} />;
  }

  return (
    <Screen header={<ScreenHeader title="Loan" />}>
      <View className="w-full max-w-2xl gap-5 self-center">{body}</View>
    </Screen>
  );
}

function LoanDetails({ loan, focusReview }: { loan: L; focusReview: boolean }) {
  const uid = useSessionStore((s) => s.user?.uid) ?? '';
  const now = useNow();
  const loans = useMemo(() => [loan], [loan]);
  const people = useLoanPeople(loans);
  const sheets = useLoanSheets();
  const linkMap = useLinkMap();
  const { profile: me } = useMyProfile();

  const owner = loan.ownerId === uid;
  const name = people.name(loan);
  const phone = people.phone(loan);
  const greet = people.greetName(loan);
  const pickupNote = owner ? (me?.pickupNote ?? null) : people.pickupNote(loan);

  // "Lent to someone else · back around 12 Dec": the copy's due date, when I can read it.
  const wantsBack =
    !owner && loan.status === 'declined' && loan.declineReason === 'lentToSomeoneElse';
  const { item } = useItem(wantsBack ? loan.itemId : null);
  const { isWatchingBack, loading: watchesLoading } = useWatches();
  const { asBorrower } = useMyLoans();

  // QA B13: a request-loan without a borrower, or one the server marked, means they left.
  const borrowerLeft = owner && !loan.borrowerUid && (!!loan.requestedAt || !!loan.borrowerLeftAt);
  const view = loanView({
    loan,
    uid,
    other: name,
    otherHasPhone: !!phone,
    pickupNote,
    backAround: backAroundFor(item, new Set(asBorrower.map((l) => l.id))),
    watchingBack: wantsBack && !watchesLoading ? isWatchingBack(loan.itemId) : undefined,
    // QA B12: the copy came back since it went to someone else.
    copyAvailable: wantsBack && item?.loanState === 'available' && item.visibility === 'lendable',
    borrowerLeft,
    now,
  });
  // QA B8: once my review is saved, say so instead of asking again (E10).
  const { data: myReview } = useDocData<Review>(
    view.showReview && uid ? `${COLLECTIONS.reviews}/${reviewId(loan.workId, uid)}` : null
  );
  const busy = sheets.busyId === loan.id;

  const whatsapp = (text: string) => {
    if (phone) void openWhatsApp(phone, text);
  };
  const messageText = () => {
    if (loan.status === 'requested') {
      return owner
        ? requestReplyMessage(greet, loan.title)
        : requestFollowUpMessage(greet, loan.title);
    }
    if (view.phase === 'pickup') {
      return owner
        ? pickupOwnerMessage({ borrowerName: greet, title: loan.title, pickupNote })
        : pickupBorrowerMessage({ ownerName: greet, title: loan.title });
    }
    if (!owner && loan.status === 'active' && loan.notBackYetAt) {
      return notBackYetReplyMessage({ ownerName: greet, title: loan.title });
    }
    return loanChatMessage({ name: greet, title: loan.title });
  };

  const run = (action: LoanAction) => {
    switch (action) {
      case 'accept':
        return sheets.accept(loan);
      case 'decline':
      case 'cancelRequest':
      case 'markReturned':
      case 'gotItBack':
      case 'notBackYet':
      case 'notCollected':
        return sheets.confirm(action, loan);
      case 'changeDue':
        return sheets.changeDue(loan);
      case 'message':
        return whatsapp(messageText());
      case 'askMoreTime':
        return whatsapp(
          moreTimeMessage({ ownerName: greet, title: loan.title, dueDate: loan.dueDate })
        );
      case 'notPickingUp':
        return whatsapp(notPickingUpMessage({ ownerName: greet, title: loan.title }));
      case 'nudge':
        return whatsapp(nudgeLoanMessage(greet, loan));
      case 'addToWishlist':
        return void setWishlisted(uid, { workId: loan.workId, title: loan.title }, true)
          .then(() =>
            toast.success('Added to your wishlist', {
              description: 'We’ll tell you when someone you know has it.',
            })
          )
          .catch((e: unknown) => toastError(e));
      case 'stopNotify':
      case 'notifyMe': {
        const on = action === 'notifyMe';
        return void setWatchingBack(
          uid,
          { id: loan.itemId, workId: loan.workId, title: loan.title },
          on
        )
          .then(() => toast.success(on ? 'We’ll tell you when it’s back' : 'Notify me is off'))
          .catch((e: unknown) => toastError(e));
      }
      case 'askAgain':
        return canOpenCopy(loan, uid, new Set(linkMap.keys()))
          ? router.push({ pathname: '/copy/[itemId]', params: { itemId: loan.itemId } })
          : router.push({ pathname: '/book/[workId]', params: { workId: loan.workId } });
    }
  };

  const primaryIsWhatsApp = !!view.primary && WHATSAPP_ACTIONS.includes(view.primary);
  const copyOpenable = canOpenCopy(loan, uid, new Set(linkMap.keys()));
  const timeline = loanTimeline(loan, uid, name);

  return (
    <>
      {/* 1. Book row */}
      <Pressable
        onPress={
          copyOpenable
            ? () => router.push({ pathname: '/copy/[itemId]', params: { itemId: loan.itemId } })
            : undefined
        }
        disabled={!copyOpenable}
        accessibilityRole={copyOpenable ? 'button' : undefined}
        accessibilityHint={copyOpenable ? 'Opens the copy' : undefined}
        className="flex-row items-center gap-3 rounded-xl active:opacity-70"
      >
        <BookCover uri={loan.coverUrl} title={loan.title} size="sm" />
        <View className="flex-1 gap-1">
          <Text className="text-lg font-bold leading-6" role="heading">
            {loan.title}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {owner ? 'Your copy' : `${first(name)}’s copy`}
          </Text>
        </View>
        {copyOpenable ? (
          <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
        ) : null}
      </Pressable>

      {/* 2. State banner with one primary for my role */}
      <Banner view={view} name={name} busy={busy} onAction={run} />

      {/* 3. Other party */}
      <View>
        <SectionHeader title={owner ? 'Borrower' : 'Owner'} />
        <Card className="flex-row items-center gap-3 px-4 py-3">
          <PersonAvatar name={name} />
          <View className="flex-1 gap-0.5">
            <Text className="font-semibold">{name}</Text>
            {people.profileAlias(loan) ? (
              <Text className="text-xs text-muted-foreground">{people.profileAlias(loan)}</Text>
            ) : null}
            {people.notInContacts(loan) ? (
              <Text className="text-xs text-muted-foreground">{people.notInContacts(loan)}</Text>
            ) : null}
            {owner && !loan.borrowerUid && !borrowerLeft ? (
              <Text className="text-xs text-muted-foreground">Not on LendShelf</Text>
            ) : null}
            {borrowerLeft || loan.status === 'ownerLeft' ? (
              <View className="flex-row items-center gap-1">
                <Icon as={UserX} size={12} className="text-muted-foreground" />
                <Text className="text-xs text-muted-foreground">Left LendShelf</Text>
              </View>
            ) : null}
            {!owner && pickupNote?.trim() ? (
              <Text className="text-xs text-muted-foreground">Pickup: {pickupNote.trim()}</Text>
            ) : null}
          </View>
          {/* R27: hidden when the banner's primary is already a WhatsApp action. */}
          {phone && !primaryIsWhatsApp ? (
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onPress={() => whatsapp(messageText())}
              accessibilityLabel={`Message ${first(name)} on WhatsApp`}
            >
              <Icon as={MessageCircle} size={18} />
            </Button>
          ) : null}
        </Card>
      </View>

      {/* 4. Due date */}
      {loan.dueDate && (loan.status === 'active' || loan.status === 'returnPending') ? (
        <DueRow
          due={loan.dueDate.toDate()}
          now={now}
          onChange={owner && loan.status === 'active' ? () => sheets.changeDue(loan) : undefined}
        />
      ) : null}

      {/* 5. Note */}
      {loan.message ? (
        <View className="gap-1 rounded-lg bg-muted px-3 py-2">
          <Text className="text-xs font-medium text-muted-foreground">
            {owner ? `${first(name)} wrote` : 'You wrote'}
          </Text>
          <Text className="text-sm leading-5">{loan.message}</Text>
        </View>
      ) : null}

      {/* 7. How was it? (borrower, after a normal return) */}
      {view.showReview ? (
        <Card className={cn('items-center gap-2 px-4 py-4', focusReview && 'border-primary')}>
          <Text className="font-semibold">{myReview ? 'Your review' : 'How was it?'}</Text>
          <StarPicker
            value={myReview?.rating ?? 0}
            size={36}
            onChange={(rating) =>
              router.push({
                pathname: '/review/[workId]',
                params: { workId: loan.workId, rating: String(rating) },
              })
            }
          />
          <Text className="text-xs text-muted-foreground">
            {myReview
              ? `Thanks. ${first(name)} and others can see it. Tap a star to change it.`
              : 'Tap a star to review it'}
          </Text>
        </Card>
      ) : null}

      {/* 6. Timeline */}
      {timeline.length ? (
        <View>
          <SectionHeader title="Timeline" />
          <Card className="gap-0 px-4 py-2">
            {timeline.map((e, i) => (
              <View
                key={e.key}
                className="flex-row gap-3 py-2"
                accessible
                accessibilityLabel={`${e.label}, ${formatLongDate(e.at)}`}
              >
                <View className="items-center">
                  <View className="mt-1.5 size-2 rounded-full bg-muted-foreground" />
                  {i < timeline.length - 1 ? <View className="mt-1 w-px flex-1 bg-border" /> : null}
                </View>
                <Text className="flex-1 text-sm">{e.label}</Text>
                <Text className="text-xs text-muted-foreground">{formatShortDate(e.at, now)}</Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {sheets.element}
    </>
  );
}

function Banner({
  view,
  name,
  busy,
  onAction,
}: {
  view: LoanView;
  name: string;
  busy: boolean;
  onAction(a: LoanAction): void;
}) {
  const tone = TONES[view.banner.tone];
  const label = (a: LoanAction) => actionLabel(a, view, name);
  const isWa = (a: LoanAction) => WHATSAPP_ACTIONS.includes(a);
  const status = sentences([view.banner.title, view.banner.detail]);
  // F8: a state change (sent, accepted, closed) is announced. Android reads the live region
  // below; iOS has no live regions, so announce it there. Not on first render.
  const lastStatus = useRef(status);
  useEffect(() => {
    if (lastStatus.current === status) return;
    lastStatus.current = status;
    if (Platform.OS === 'ios') announce(status);
  }, [status]);
  return (
    <View className={cn('gap-3 rounded-xl border p-4', tone.box)}>
      <View className="flex-row gap-3">
        <Icon as={tone.Icon} size={20} className={cn('mt-0.5', tone.icon)} />
        {/* Status first, then the actions (F8 reading order); only the status is live. */}
        <View
          className="flex-1 gap-0.5"
          accessible
          accessibilityRole="header"
          accessibilityLabel={status}
          accessibilityLiveRegion="polite"
        >
          <Text className="text-base font-semibold">{view.banner.title}</Text>
          {view.banner.detail ? (
            <Text className="text-sm text-muted-foreground">{view.banner.detail}</Text>
          ) : null}
        </View>
      </View>
      {view.primary || view.secondary.length ? (
        <View className="gap-2">
          {view.primary ? (
            isWa(view.primary) ? (
              <WhatsAppButton
                label={label(view.primary)}
                onPress={() => onAction(view.primary!)}
                className="min-h-12"
              />
            ) : (
              <Button
                size="lg"
                className="min-h-12"
                disabled={busy}
                onPress={() => onAction(view.primary!)}
              >
                {busy ? <ActivityIndicator size="small" /> : null}
                <Text>{label(view.primary)}</Text>
              </Button>
            )
          ) : null}
          {view.secondary.length ? (
            <View className="flex-row flex-wrap gap-2">
              {view.secondary.map((a) => (
                <Button
                  key={a}
                  variant="outline"
                  className="min-h-12 min-w-32 flex-1"
                  disabled={busy && !isWa(a)}
                  onPress={() => onAction(a)}
                >
                  {isWa(a) ? <Icon as={MessageCircle} size={15} /> : null}
                  <Text>{label(a)}</Text>
                </Button>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {view.tertiary.length ? (
        <View className="flex-row flex-wrap">
          {view.tertiary.map((a) => (
            <Button
              key={a}
              variant="ghost"
              className="min-h-12 px-2"
              disabled={busy && !isWa(a)}
              onPress={() => onAction(a)}
            >
              {a === 'changeDue' ? <Icon as={CalendarClock} size={15} /> : null}
              <Text className="text-sm underline-offset-4">{label(a)}</Text>
            </Button>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DueRow({ due, now, onChange }: { due: Date; now: Date; onChange?: () => void }) {
  const overdue = isOverdue(due, now);
  const hint = overdue
    ? dueLabel(due, now).replace(/^overdue (.*)$/, '$1 overdue')
    : relativeDueHint(due, now);
  // The overdue / "in 3 days" hint is part of the label, not only the red text (F8).
  const label = sentences([`Due ${formatLongDate(due)}`, hint]);
  const content = (
    <>
      <Icon as={CalendarDays} size={18} className="text-muted-foreground" />
      <View className="flex-1">
        <Text className="font-medium">Due {formatLongDate(due)}</Text>
        <Text
          className={cn(
            'text-xs',
            overdue ? 'font-medium text-destructive' : 'text-muted-foreground'
          )}
        >
          {hint}
        </Text>
      </View>
      {onChange ? <Text className="text-sm font-medium text-primary">Change</Text> : null}
    </>
  );
  return onChange ? (
    <Pressable
      onPress={onChange}
      accessibilityRole="button"
      accessibilityLabel={`${label} Change due date`}
      className="min-h-12 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 active:bg-accent"
    >
      {content}
    </Pressable>
  ) : (
    <View
      className="min-h-12 flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
      accessible
      accessibilityLabel={label}
    >
      {content}
    </View>
  );
}
