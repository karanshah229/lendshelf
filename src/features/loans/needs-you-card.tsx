/**
 * The Needs-you card (UX §D4): one card per thing I have to act on, at most one filled primary
 * each, everything else outline or text. Used by the Loans tab and (C7) the Home stack.
 *
 *   const { cards } = useNeedsYou();
 *   <NeedsYouList cards={cards.slice(0, 2)} />
 *
 * `NeedsYouList` owns the sheets (confirm, due date, WhatsApp success, request chooser);
 * use `NeedsYouCard` directly only when you already have `useLoanSheets()`/`useLoanPeople()`.
 */
import { router } from 'expo-router';
import {
  CalendarClock,
  Check,
  CircleAlert,
  Clock,
  Inbox,
  MessageCircle,
  PackageCheck,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { expiryLabel } from '@/features/loans/buckets';
import { useLoanSheets, type LoanSheets } from '@/features/loans/loan-sheets';
import {
  moreTimeMessage,
  notBackYetReplyMessage,
  nudgeLoanMessage,
  openWhatsApp,
  pickupBorrowerMessage,
  requestFollowUpMessage,
  requestReplyMessage,
} from '@/features/loans/messages';
import { cardLoans, type NeedsYouCard as Card } from '@/features/loans/needs-you';
import { useLoanPeople, type LoanPeople } from '@/features/loans/use-loan-people';
import { joinNames, shortName } from '@/features/shared/people';
import { cardLabel, clipText } from '@/lib/a11y';
import { dueLabel, timeAgo } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useDismissedStore } from '@/stores/dismissed';
import type { Loan, WithId } from '@/types/model';

type L = WithId<Loan>;

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const first = shortName;
/** 48 dp touch targets (F8) without making the buttons look bigger than 44. */
const HIT = { top: 4, bottom: 4, left: 2, right: 2 };
/** Longest request note shown on a card; the full note is in the screen-reader label. */
const QUOTE_MAX = 60;
/** Compact cards (Home layout budget, D4): 40 dp buttons, still a 48 dp hit area via HIT. */
const Compact = createContext(false);

export function openLoan(loanId: string) {
  router.push({ pathname: '/loan/[loanId]', params: { loanId } });
}

/** All cards, with their sheets. Pass a slice for Home (max 2), `compact` for Home's budget. */
export function NeedsYouList({
  cards,
  className,
  compact = false,
}: {
  cards: readonly Card[];
  className?: string;
  compact?: boolean;
}) {
  const loans = cards.flatMap(cardLoans);
  const people = useLoanPeople(loans);
  const sheets = useLoanSheets();
  const [chooser, setChooser] = useState<L[] | null>(null);
  return (
    <Compact.Provider value={compact}>
      <View className={cn(compact ? 'gap-2' : 'gap-3', className)}>
        {cards.map((card) => (
          <NeedsYouCard
            key={card.key}
            card={card}
            people={people}
            sheets={sheets}
            onChoose={setChooser}
          />
        ))}
      </View>
      {/* Outside the gap container: closed sheets must not add spacing. */}
      {sheets.element}
      <RequestChooser
        loans={chooser}
        people={people}
        onClose={() => setChooser(null)}
        onLend={(l) => {
          setChooser(null);
          sheets.accept(l);
        }}
        onDecline={(l) => {
          setChooser(null);
          sheets.confirm('decline', l);
        }}
        onDeclineAll={(ls) => {
          setChooser(null);
          sheets.declineAll(ls);
        }}
      />
    </Compact.Provider>
  );
}

/** Props: the card plus the shared people/sheets helpers. */
export function NeedsYouCard({
  card,
  people,
  sheets,
  onChoose,
}: {
  card: Card;
  people: LoanPeople;
  sheets: LoanSheets;
  /** Grouped request card: open the chooser with these requests. */
  onChoose(loans: L[]): void;
}) {
  const loan = card.kind === 'requests' ? card.loans[0]! : card.loan;
  const name = people.name(loan);
  const phone = people.phone(loan);
  const greet = people.greetName(loan);
  const busy = cardLoans(card).some((l) => l.id === sheets.busyId);
  /** QA B11: the spinner goes on the button whose action is running; the others are disabled. */
  const running = (kind: NonNullable<LoanSheets['busyKind']>) => busy && sheets.busyKind === kind;
  const wa = (text: string) => (phone ? () => void openWhatsApp(phone, text) : undefined);
  const heading = (before?: string, after?: string) => (
    <Text className="text-[15px] leading-5">
      {before}
      <Text className="text-[15px] font-semibold leading-5">{loan.title}</Text>
      {after}
    </Text>
  );

  switch (card.kind) {
    case 'requests': {
      if (card.loans.length > 1) {
        const names = card.loans.map((l) => first(people.name(l)));
        // "Not in your contacts · number" for each one-way requester (E5).
        const oneWay = card.loans
          .map((l) => {
            const cue = people.notInContacts(l);
            return cue ? `${first(people.name(l))}: ${cue}` : null;
          })
          .filter(Boolean)
          .join('\n');
        return (
          <Shell
            loan={loan}
            icon={Inbox}
            tone="action"
            onOpen={() => onChoose(card.loans)}
            openHint="Choose who to lend it to"
            title={heading(`${card.loans.length} people want `)}
            titleText={`${card.loans.length} people want ${loan.title}`}
            context={`${joinNames(names, 10)} · first asked ${loan.requestedAt ? timeAgo(loan.requestedAt) : 'recently'}`}
            note={oneWay || null}
            actions={
              card.loans.length === 2
                ? card.loans.map((l) => `Lend to ${first(people.name(l))}`)
                : ['Choose who']
            }
          >
            {card.loans.length === 2 ? (
              // C4: with two requesters, pick on the card; the due-date sheet is the confirm
              // (2 taps). Both are outline: no ordering rule, the owner picks (E5).
              card.loans.map((l) => (
                <Secondary
                  key={l.id}
                  label={`Lend to ${first(people.name(l))}`}
                  icon={Check}
                  busy={busy}
                  onPress={() => sheets.accept(l)}
                />
              ))
            ) : (
              <Primary
                label="Choose who"
                icon={Check}
                busy={busy}
                onPress={() => onChoose(card.loans)}
              />
            )}
          </Shell>
        );
      }
      const oneWay = people.notInContacts(loan);
      return (
        <Shell
          loan={loan}
          icon={Inbox}
          tone="action"
          onOpen={() => openLoan(loan.id)}
          title={heading(`${name} wants `)}
          titleText={`${name} wants ${loan.title}`}
          // The expiry must never be cut off (F8): a long note is shortened on the card instead.
          context={[
            loan.message ? `“${clipText(loan.message, QUOTE_MAX)}”` : null,
            expiryLabel(loan),
          ]
            .filter(Boolean)
            .join(' · ')}
          contextLabel={[loan.message ? `“${loan.message.trim()}”` : null, expiryLabel(loan)]
            .filter(Boolean)
            .join('. ')}
          note={oneWay}
          actions={['Accept', 'Decline', ...(phone ? [`Message ${first(name)} on WhatsApp`] : [])]}
        >
          <Primary
            label="Accept"
            icon={Check}
            busy={busy}
            spinning={running('accept')}
            onPress={() => sheets.accept(loan)}
          />
          <Secondary
            label="Decline"
            icon={X}
            busy={busy}
            spinning={running('decline')}
            onPress={() => sheets.confirm('decline', loan)}
          />
          {phone ? (
            <IconAction
              icon={MessageCircle}
              label={`Message ${first(name)} on WhatsApp`}
              onPress={wa(requestReplyMessage(greet, loan.title))!}
            />
          ) : null}
        </Shell>
      );
    }
    case 'saysReturned':
      return (
        <Shell
          loan={loan}
          icon={Undo2}
          tone="action"
          onOpen={() => openLoan(loan.id)}
          title={heading(`${name} says they returned `)}
          titleText={`${name} says they returned ${loan.title}`}
          context="Confirm when you have it"
          actions={['Got it back', 'Not back yet']}
        >
          {/* One tap: the borrower already said it's back, so both sides agree (E6). */}
          <Primary
            label="Got it back"
            icon={PackageCheck}
            busy={busy}
            spinning={running('gotItBack')}
            onPress={() => sheets.gotItBackNow(loan)}
          />
          <Secondary
            label="Not back yet"
            icon={X}
            busy={busy}
            spinning={running('notBackYet')}
            onPress={() => sheets.confirm('notBackYet', loan)}
          />
        </Shell>
      );
    case 'overdueLent': {
      const days = `${card.daysOverdue} day${card.daysOverdue === 1 ? '' : 's'} overdue`;
      const nudge = wa(nudgeLoanMessage(greet, loan));
      return (
        <Shell
          loan={loan}
          icon={CircleAlert}
          tone="danger"
          onOpen={() => openLoan(loan.id)}
          title={heading(undefined, ` with ${name}`)}
          titleText={`${loan.title} with ${name}`}
          context={days}
          contextDanger
          actions={[...(nudge ? ['Nudge on WhatsApp'] : []), 'Got it back', 'Change due date']}
        >
          {nudge ? (
            <>
              <Primary label="Nudge on WhatsApp" icon={MessageCircle} busy={busy} onPress={nudge} />
              <Secondary
                label="Got it back"
                icon={PackageCheck}
                busy={busy}
                onPress={() => sheets.confirm('gotItBack', loan)}
              />
            </>
          ) : (
            <Primary
              label="Got it back"
              icon={PackageCheck}
              busy={busy}
              onPress={() => sheets.confirm('gotItBack', loan)}
            />
          )}
          <IconAction
            icon={CalendarClock}
            label="Change due date"
            onPress={() => sheets.changeDue(loan)}
          />
        </Shell>
      );
    }
    case 'dueBorrowed': {
      const label = dueLabel(loan.dueDate);
      const overdue = label.startsWith('overdue');
      const more = wa(
        moreTimeMessage({ ownerName: greet, title: loan.title, dueDate: loan.dueDate })
      );
      return (
        <Shell
          loan={loan}
          icon={overdue ? CircleAlert : Clock}
          tone={overdue ? 'danger' : 'warning'}
          onOpen={() => openLoan(loan.id)}
          title={heading(undefined, ` from ${name}`)}
          titleText={`${loan.title} from ${name}`}
          context={overdue ? label.replace(/^overdue (.*)$/, '$1 overdue') : label}
          contextDanger={overdue}
          actions={['I’ve returned it', ...(more ? ['Ask for more time'] : [])]}
        >
          <Primary
            label="I’ve returned it"
            icon={PackageCheck}
            busy={busy}
            onPress={() => sheets.confirm('markReturned', loan)}
          />
          {more ? (
            <Secondary label="Ask for more time" icon={MessageCircle} onPress={more} />
          ) : null}
        </Shell>
      );
    }
    case 'notBackYet': {
      // QA B1: the owner said "Not back yet". Talk first; "I've returned it" stays as S.
      const msg = wa(notBackYetReplyMessage({ ownerName: greet, title: loan.title }));
      const label = loan.dueDate ? dueLabel(loan.dueDate) : null;
      const overdue = !!label?.startsWith('overdue');
      return (
        <Shell
          loan={loan}
          icon={overdue ? CircleAlert : Clock}
          tone={overdue ? 'danger' : 'warning'}
          onOpen={() => openLoan(loan.id)}
          title={heading(`${first(name)} hasn’t got `, ' back yet')}
          titleText={`${first(name)} hasn’t got ${loan.title} back yet`}
          context={label ? (overdue ? label.replace(/^overdue (.*)$/, '$1 overdue') : label) : null}
          contextDanger={overdue}
          actions={[...(msg ? [`Message ${first(name)}`] : []), 'I’ve returned it']}
        >
          {msg ? (
            <Primary label={`Message ${first(name)}`} icon={MessageCircle} onPress={msg} />
          ) : null}
          {msg ? (
            <Secondary
              label="I’ve returned it"
              icon={PackageCheck}
              busy={busy}
              onPress={() => sheets.confirm('markReturned', loan)}
            />
          ) : (
            <Primary
              label="I’ve returned it"
              icon={PackageCheck}
              busy={busy}
              onPress={() => sheets.confirm('markReturned', loan)}
            />
          )}
        </Shell>
      );
    }
    case 'pickup': {
      const note = people.pickupNote(loan);
      const msg = wa(pickupBorrowerMessage({ ownerName: greet, title: loan.title }));
      return (
        <Shell
          loan={loan}
          icon={Check}
          tone="action"
          onOpen={() => openLoan(loan.id)}
          // Short name, like the R14 card next to it ("Asha said yes to Sapiens", QA friction).
          title={heading(`${first(name)} said yes to `)}
          titleText={`${first(name)} said yes to ${loan.title}`}
          actions={msg ? [`Message ${first(name)}`] : []}
          context={
            note?.trim()
              ? `Pick up from ${first(name)} · pickup: ${note.trim()}`
              : `Pick up from ${first(name)}`
          }
        >
          {msg ? (
            <Primary label={`Message ${first(name)}`} icon={MessageCircle} onPress={msg} />
          ) : null}
        </Shell>
      );
    }
    case 'otherAccepted': {
      // R14: "Asha said yes to Sapiens. Cancel your request to Kabir?"
      const yes = first(people.name(card.accepted));
      return (
        <Shell
          loan={card.accepted}
          icon={Clock}
          tone="action"
          onOpen={() => openLoan(loan.id)}
          openHint="Opens your other request"
          title={
            <Text className="text-[15px] leading-5">
              {yes} said yes to{' '}
              <Text className="text-[15px] font-semibold leading-5">{loan.title}</Text>. Cancel your
              request to {first(name)}?
            </Text>
          }
          titleText={`${yes} said yes to ${loan.title}. Cancel your request to ${first(name)}?`}
          context={expiryLabel(loan) ? `Your request ${expiryLabel(loan)}` : null}
          actions={['Cancel the other request', 'Keep both']}
        >
          <Primary
            label="Cancel the other request"
            icon={X}
            busy={busy}
            onPress={() => sheets.confirm('cancelRequest', loan)}
          />
          <Secondary
            label="Keep both"
            icon={Check}
            busy={busy}
            onPress={() => useDismissedStore.getState().dismiss(card.key)}
          />
        </Shell>
      );
    }
    case 'requestExpiring': {
      const msg = wa(requestFollowUpMessage(greet, loan.title));
      return (
        <Shell
          loan={loan}
          icon={Clock}
          tone="warning"
          onOpen={() => openLoan(loan.id)}
          title={
            <Text className="text-[15px] leading-5">
              Your request to {name} {expiryLabel(loan) ?? 'expires soon'}
            </Text>
          }
          titleText={`Your request to ${name} ${expiryLabel(loan) ?? 'expires soon'}`}
          context={loan.title}
          actions={msg ? [`Message ${first(name)}`] : []}
        >
          {msg ? (
            <Primary label={`Message ${first(name)}`} icon={MessageCircle} onPress={msg} />
          ) : null}
        </Shell>
      );
    }
  }
}

// ---------- Building blocks ----------

type Tone = 'action' | 'warning' | 'danger';

function Shell({
  loan,
  icon,
  tone,
  title,
  titleText,
  context,
  contextLabel,
  contextDanger,
  note,
  actions,
  onOpen,
  openHint = 'Opens the loan',
  children,
}: {
  loan: L;
  icon: LucideIcon;
  tone: Tone;
  title: ReactNode;
  /** The title as plain text, for the card's one screen-reader label. */
  titleText: string;
  /** Status in words; never truncated (F8). */
  context?: string | null;
  /** Full context for the label when the visible one is shortened. */
  contextLabel?: string | null;
  contextDanger?: boolean;
  note?: string | null;
  /** The buttons' names in visual order: "… Accept or decline." */
  actions: readonly string[];
  onOpen(): void;
  openHint?: string;
  children: ReactNode;
}) {
  const compact = useContext(Compact);
  // One label for the whole card: title, status in words, then what can be done (F8).
  const label = cardLabel({
    title: titleText,
    context: contextLabel ?? context,
    note,
    actions,
  });
  return (
    <View
      className={cn(
        'rounded-xl border bg-card shadow-sm shadow-black/5',
        compact ? 'gap-2 px-3 py-2.5' : 'gap-2.5 p-3',
        tone === 'danger' ? 'border-destructive/40' : 'border-amber-500/50'
      )}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={openHint}
        className="flex-row gap-3 active:opacity-70"
      >
        <BookCover uri={loan.coverUrl} title={loan.title} size="xs" />
        <View className="flex-1 gap-0.5">
          {title}
          {context ? (
            <View className="flex-row items-center gap-1">
              <Icon
                as={icon}
                size={12}
                className={contextDanger ? 'text-destructive' : 'text-muted-foreground'}
              />
              <Text
                className={cn(
                  'flex-1 text-xs',
                  contextDanger ? 'font-medium text-destructive' : 'text-muted-foreground'
                )}
              >
                {context}
              </Text>
            </View>
          ) : null}
          {note ? <Text className="text-xs text-muted-foreground">{note}</Text> : null}
        </View>
      </Pressable>
      <View className="flex-row flex-wrap items-center gap-2">{children}</View>
    </View>
  );
}

function Primary({
  label,
  icon,
  onPress,
  busy,
  spinning,
}: {
  label: string;
  icon: LucideIcon;
  onPress(): void;
  /** Disabled while any action on the card runs. */
  busy?: boolean;
  /** This button's own action is running (defaults to `busy`). */
  spinning?: boolean;
}) {
  const compact = useContext(Compact);
  return (
    <Button
      className={cn('min-w-28 flex-1', compact ? 'min-h-10' : 'min-h-11')}
      onPress={onPress}
      disabled={busy}
      hitSlop={HIT}
    >
      {(spinning ?? busy) ? (
        <ActivityIndicator size="small" />
      ) : (
        <Icon as={icon} size={15} className="text-primary-foreground" />
      )}
      <Text>{label}</Text>
    </Button>
  );
}

function Secondary({
  label,
  icon,
  onPress,
  busy,
  spinning,
}: {
  label: string;
  icon: LucideIcon;
  onPress(): void;
  busy?: boolean;
  /** This button's own action is running. */
  spinning?: boolean;
}) {
  const compact = useContext(Compact);
  return (
    <Button
      variant="outline"
      className={cn('min-w-28 flex-1', compact ? 'min-h-10' : 'min-h-11')}
      onPress={onPress}
      disabled={busy}
      hitSlop={HIT}
    >
      {spinning ? <ActivityIndicator size="small" /> : <Icon as={icon} size={15} />}
      <Text>{label}</Text>
    </Button>
  );
}

function IconAction({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress(): void;
}) {
  const compact = useContext(Compact);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={compact ? 'h-10 w-11' : 'h-11 w-11'}
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={HIT}
    >
      <Icon as={icon} size={18} />
    </Button>
  );
}

/** "2 people want Animal Farm" → pick who gets it (E5). */
function RequestChooser({
  loans,
  people,
  onClose,
  onLend,
  onDecline,
  onDeclineAll,
}: {
  loans: L[] | null;
  people: LoanPeople;
  onClose(): void;
  onLend(l: L): void;
  onDecline(l: L): void;
  /** T "Decline all" at the bottom (E5, QA B15). */
  onDeclineAll(loans: L[]): void;
}) {
  const title = loans?.[0]?.title ?? '';
  return (
    <Dialog open={!!loans} onOpenChange={(o) => !o && onClose()}>
      {loans ? (
        <DialogContent className="w-[22rem] max-w-full">
          <DialogHeader>
            <DialogTitle>Who gets “{title}”?</DialogTitle>
            <DialogDescription>
              The others are told it went to someone else, and we’ll tell them when it’s back.
            </DialogDescription>
          </DialogHeader>
          <View className="gap-3">
            {loans.map((l) => {
              const name = people.name(l);
              const oneWay = people.notInContacts(l);
              return (
                <View key={l.id} className="gap-2 rounded-lg border border-border p-3">
                  <Pressable
                    onPress={() => {
                      onClose();
                      openLoan(l.id);
                    }}
                    accessibilityRole="button"
                    accessibilityHint="Opens the request"
                    className="gap-0.5"
                  >
                    <Text className="font-semibold">{name}</Text>
                    {oneWay ? (
                      <Text className="text-xs text-muted-foreground">{oneWay}</Text>
                    ) : null}
                    {l.message ? (
                      <Text className="text-sm" numberOfLines={2}>
                        “{l.message.trim()}”
                      </Text>
                    ) : null}
                    <Text className="text-xs text-muted-foreground">
                      {[l.requestedAt ? `Asked ${timeAgo(l.requestedAt)}` : null, expiryLabel(l)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Pressable>
                  <View className="flex-row gap-2">
                    <Button className="min-h-11 flex-1" onPress={() => onLend(l)} hitSlop={HIT}>
                      <Text>Lend to {first(name)}</Text>
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-11"
                      onPress={() => onDecline(l)}
                      hitSlop={HIT}
                      accessibilityLabel={`Decline ${first(name)}’s request`}
                    >
                      <Text>Decline</Text>
                    </Button>
                  </View>
                </View>
              );
            })}
          </View>
          {loans.length > 1 ? (
            <Button
              variant="ghost"
              className="min-h-11 self-center"
              onPress={() => onDeclineAll(loans)}
              hitSlop={HIT}
            >
              <Text className="text-sm">Decline all</Text>
            </Button>
          ) : null}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
