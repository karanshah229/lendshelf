import {
  CalendarClock,
  Check,
  CircleAlert,
  Clock,
  Ellipsis,
  ExternalLink,
  MessageCircle,
  PackageCheck,
  Send,
  Undo2,
  X,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { closedStatusLabel, requestDaysLeft } from '@/features/loans/buckets';
import { ConfirmButton } from '@/features/loans/confirm-button';
import { dueLabel, dueState, formatShortDate, timeAgo } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Loan, WithId } from '@/types/model';

type L = WithId<Loan>;

// ---------- Building blocks ----------

function capitalize(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Due-date badge: overdue (red), today/soon (amber), later (neutral). */
export function DueBadge({ due }: { due: L['dueDate'] }) {
  const state = due ? dueState(due) : null;
  const variant =
    state?.kind === 'overdue'
      ? 'destructive'
      : state?.kind === 'today' || state?.kind === 'soon'
        ? 'warning'
        : 'secondary';
  return (
    <Badge variant={variant}>
      {state?.kind === 'overdue' ? <Icon as={CircleAlert} size={11} /> : null}
      <Text>{capitalize(dueLabel(due))}</Text>
    </Badge>
  );
}

function CardShell({
  loan,
  subtitle,
  badges,
  meta,
  onOpen,
  highlight,
  children,
  actions,
}: {
  loan: L;
  subtitle: string;
  badges?: ReactNode;
  meta?: string | null;
  onOpen?: () => void;
  highlight?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <View
      className={cn(
        'gap-3 rounded-xl border border-border bg-card p-3 shadow-sm shadow-black/5',
        highlight && 'border-amber-500/60 bg-amber-500/5'
      )}
    >
      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityHint={onOpen ? 'Opens the book' : undefined}
        className="flex-row gap-3 active:opacity-70"
      >
        <BookCover uri={loan.coverUrl} title={loan.title} size="sm" />
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold leading-5" numberOfLines={2}>
            {loan.title}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
          {badges ? <View className="flex-row flex-wrap gap-1.5 pt-0.5">{badges}</View> : null}
          {meta ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {children}
      {actions ? <View className="flex-row flex-wrap gap-2">{actions}</View> : null}
    </View>
  );
}

function MessageBubble({ name, text }: { name: string; text: string }) {
  return (
    <View className="gap-1 rounded-lg bg-muted px-3 py-2">
      <Text className="text-xs font-medium text-muted-foreground">{name} wrote</Text>
      <Text className="text-sm leading-5">{text}</Text>
    </View>
  );
}

function Banner({ icon, children }: { icon: typeof Clock; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
      <Icon as={icon} size={16} className="text-amber-700 dark:text-amber-400" />
      <Text className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-300">
        {children}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  variant = 'outline',
  disabled,
  busy,
  className,
  accessibilityLabel,
}: {
  label: string;
  icon: typeof Clock;
  onPress?: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      onPress={onPress}
      disabled={disabled || busy}
      className={cn('flex-1', className)}
      accessibilityLabel={accessibilityLabel}
    >
      {busy ? <ActivityIndicator size="small" /> : <Icon as={icon} size={15} />}
      <Text>{label}</Text>
    </Button>
  );
}

function requestMeta(loan: L): string | null {
  if (!loan.requestedAt) return null;
  const left = requestDaysLeft(loan);
  const expiry =
    left === null
      ? ''
      : left === 0
        ? ' · expires today'
        : ` · expires in ${left} day${left === 1 ? '' : 's'}`;
  return `Asked ${timeAgo(loan.requestedAt)}${expiry}`;
}

// ---------- Requests ----------

export function IncomingRequestCard({
  loan,
  borrower,
  busy,
  onOpen,
  onAccept,
  onDecline,
  onMessage,
}: {
  loan: L;
  borrower: string;
  busy: boolean;
  onOpen?: () => void;
  onAccept(): void;
  onDecline(): void;
  onMessage?: () => void;
}) {
  return (
    <CardShell
      loan={loan}
      subtitle={`${borrower} wants to borrow this`}
      badges={
        <Badge variant="warning">
          <Text>New request</Text>
        </Badge>
      }
      meta={requestMeta(loan)}
      onOpen={onOpen}
      actions={
        <>
          <ConfirmButton
            label="Decline"
            icon={X}
            className="flex-1"
            busy={busy}
            title="Decline this request?"
            description={`${borrower} will be told you can’t lend “${loan.title}” right now.`}
            confirmLabel="Decline"
            destructive
            onConfirm={onDecline}
          />
          <ActionButton
            label="Accept"
            icon={Check}
            variant="default"
            onPress={onAccept}
            busy={busy}
          />
          {onMessage ? (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onPress={onMessage}
              accessibilityLabel={`Message ${borrower} on WhatsApp`}
            >
              <Icon as={MessageCircle} size={16} />
            </Button>
          ) : null}
        </>
      }
    >
      {loan.message ? <MessageBubble name={borrower} text={loan.message} /> : null}
    </CardShell>
  );
}

export function OutgoingRequestCard({
  loan,
  owner,
  busy,
  onOpen,
  onCancel,
  onMessage,
}: {
  loan: L;
  owner: string;
  busy: boolean;
  onOpen?: () => void;
  onCancel(): void;
  onMessage?: () => void;
}) {
  return (
    <CardShell
      loan={loan}
      subtitle={`You asked ${owner}`}
      badges={
        <Badge variant="outline">
          <Icon as={Clock} size={11} />
          <Text>Waiting for {owner.split(/\s+/)[0]}</Text>
        </Badge>
      }
      meta={requestMeta(loan)}
      onOpen={onOpen}
      actions={
        <>
          <ActionButton
            label="WhatsApp"
            icon={MessageCircle}
            onPress={onMessage}
            disabled={!onMessage}
          />
          <ConfirmButton
            label="Cancel request"
            icon={Undo2}
            className="flex-1"
            busy={busy}
            title="Cancel your request?"
            description={`${owner} won’t see your request for “${loan.title}” any more.`}
            confirmLabel="Cancel request"
            destructive
            onConfirm={onCancel}
          />
        </>
      }
    />
  );
}

// ---------- Lent out ----------

export function LentCard({
  loan,
  borrower,
  busy,
  onOpen,
  onNudge,
  onConfirmReturn,
  onChangeDue,
}: {
  loan: L;
  borrower: string;
  busy: boolean;
  onOpen?: () => void;
  /** Undefined when there's no phone number for the borrower. */
  onNudge?: () => void;
  onConfirmReturn(): void;
  onChangeDue(): void;
}) {
  const pending = loan.status === 'returnPending';
  const since = loan.startedAt ? `Lent ${formatShortDate(loan.startedAt)}` : null;
  const meta = [since, !loan.borrowerUid ? 'Not on LendShelf' : null].filter(Boolean).join(' · ');

  const markReturned = (
    <ConfirmButton
      label={pending ? 'Confirm returned' : 'Mark returned'}
      icon={PackageCheck}
      variant={pending ? 'default' : 'outline'}
      className="flex-1"
      busy={busy}
      title={pending ? 'Got it back?' : 'Mark as returned?'}
      description={`“${loan.title}” will show as available to your contacts again.`}
      confirmLabel="Yes, it’s back"
      onConfirm={onConfirmReturn}
    />
  );

  return (
    <CardShell
      loan={loan}
      subtitle={`With ${borrower}`}
      badges={
        pending ? (
          <Badge variant="warning">
            <Text>Says returned</Text>
          </Badge>
        ) : (
          <DueBadge due={loan.dueDate} />
        )
      }
      meta={meta || null}
      onOpen={onOpen}
      highlight={pending}
      actions={
        <>
          {pending ? null : (
            <ActionButton
              // Short so it fits next to "Mark returned" at 375 px.
              label={onNudge ? 'Nudge' : 'No phone number'}
              icon={Send}
              onPress={onNudge}
              disabled={!onNudge}
              accessibilityLabel={
                onNudge ? `Nudge ${borrower} on WhatsApp` : 'No phone number to nudge'
              }
            />
          )}
          {markReturned}
          <LentMenu
            onChangeDue={onChangeDue}
            onOpen={onOpen}
            onNudge={pending ? onNudge : undefined}
          />
        </>
      }
    >
      {pending ? (
        <Banner icon={Undo2}>{borrower} says they’ve returned it. Confirm when you have it.</Banner>
      ) : null}
    </CardShell>
  );
}

function LentMenu({
  onChangeDue,
  onOpen,
  onNudge,
}: {
  onChangeDue(): void;
  onOpen?: () => void;
  onNudge?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9" accessibilityLabel="More actions">
          <Icon as={Ellipsis} size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onPress={onChangeDue}>
          <Icon as={CalendarClock} size={16} />
          <Text>Change due date</Text>
        </DropdownMenuItem>
        {onNudge ? (
          <DropdownMenuItem onPress={onNudge}>
            <Icon as={MessageCircle} size={16} />
            <Text>Message on WhatsApp</Text>
          </DropdownMenuItem>
        ) : null}
        {onOpen ? (
          <DropdownMenuItem onPress={onOpen}>
            <Icon as={ExternalLink} size={16} />
            <Text>View copy</Text>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- Borrowed ----------

export function BorrowedCard({
  loan,
  owner,
  busy,
  onOpen,
  onMarkReturned,
  onMessage,
}: {
  loan: L;
  owner: string;
  busy: boolean;
  onOpen?: () => void;
  onMarkReturned(): void;
  onMessage?: () => void;
}) {
  const pending = loan.status === 'returnPending';
  return (
    <CardShell
      loan={loan}
      subtitle={`From ${owner}`}
      badges={
        pending ? (
          <Badge variant="outline">
            <Icon as={Clock} size={11} />
            <Text>Waiting for {owner.split(/\s+/)[0]} to confirm</Text>
          </Badge>
        ) : (
          <DueBadge due={loan.dueDate} />
        )
      }
      meta={loan.startedAt ? `Borrowed ${formatShortDate(loan.startedAt)}` : null}
      onOpen={onOpen}
      actions={
        <>
          <ActionButton
            label={`Message ${owner.split(/\s+/)[0]}`}
            icon={MessageCircle}
            onPress={onMessage}
            disabled={!onMessage}
          />
          {pending ? null : (
            <ConfirmButton
              label="I’ve returned it"
              icon={PackageCheck}
              variant="default"
              className="flex-1"
              busy={busy}
              title="Returned it?"
              description={`${owner} will be asked to confirm they have “${loan.title}” back.`}
              confirmLabel="Yes, I’ve returned it"
              onConfirm={onMarkReturned}
            />
          )}
        </>
      }
    />
  );
}

// ---------- History ----------

export function HistoryRow({ loan, line, onOpen }: { loan: L; line: string; onOpen?: () => void }) {
  const when = loan.returnedAt ?? loan.updatedAt;
  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? 'button' : undefined}
      className="flex-row items-center gap-3 rounded-lg px-1 py-2 active:bg-accent"
    >
      <BookCover uri={loan.coverUrl} title={loan.title} size="xs" />
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-medium" numberOfLines={1}>
          {loan.title}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {line}
        </Text>
      </View>
      <View className="items-end gap-0.5">
        <Badge variant={loan.status === 'returned' ? 'success' : 'outline'}>
          <Text>{closedStatusLabel(loan.status)}</Text>
        </Badge>
        {when ? (
          <Text className="text-[11px] text-muted-foreground">{formatShortDate(when)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
