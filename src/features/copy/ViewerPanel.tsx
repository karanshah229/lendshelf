/**
 * Copy page for someone else's copy: status, Ask to borrow, Notify me when it's back,
 * Message on WhatsApp, cancel my request.
 */
import { router } from 'expo-router';
import {
  ArrowRight,
  BellOff,
  BellRing,
  BookLock,
  ChevronRight,
  Clock,
  HandHelping,
  MessageCircle,
  PackageCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useProfile } from '@/hooks/use-auth';
import { useLoan } from '@/hooks/use-loans';
import { api } from '@/lib/api';
import { backLabel, dueLabel } from '@/lib/dates';
import { toast, toastError } from '@/lib/toast';
import { aboutBookMessage, returnMessage } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import type { Item, Loan, WithId } from '@/types/model';

import { AskDialog, type AskTarget } from '@/features/copy/AskDialog';
import type { ViewerCopyState } from '@/features/copy/copy-actions';
import { ConfirmButton } from '@/features/loans/confirm-button';
import { requestFollowUpMessage } from '@/features/loans/messages';
import { inPickupWindow } from '@/features/loans/needs-you';
import { setWatchingBack } from '@/features/shared/mutations';
import { capitalize, shortName } from '@/features/shared/people';
import { ListRow, PersonAvatar, SectionHeader } from '@/features/shared/ui';
import { openWhatsApp } from '@/features/shared/whatsapp-open';

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const firstName = shortName;

function StatusHero({
  icon,
  tone,
  title,
  detail,
}: {
  icon: LucideIcon;
  tone: 'success' | 'warning' | 'muted' | 'info';
  title: string;
  detail?: string | null;
}) {
  const tones = {
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    muted: 'bg-muted text-muted-foreground',
  } as const;
  return (
    <View className="flex-row items-center gap-3">
      <View className={cn('size-10 items-center justify-center rounded-full', tones[tone])}>
        <Icon as={icon} size={20} className={tones[tone]} />
      </View>
      <View className="flex-1">
        <Text className="font-semibold">{title}</Text>
        {detail ? <Text className="text-sm text-muted-foreground">{detail}</Text> : null}
      </View>
    </View>
  );
}

export function ViewerPanel({
  item,
  state,
  uid,
  ownerName,
  ownerPhone,
}: {
  item: WithId<Item>;
  state: ViewerCopyState;
  uid: string;
  ownerName: string;
  ownerPhone: string | null;
}) {
  const { profile } = useProfile(item.ownerId);
  const { loan: myBorrowLoan } = useLoan(state.myBorrow?.id);
  const [askTarget, setAskTarget] = useState<AskTarget | null>(null);
  const [busy, setBusy] = useState<'watch' | 'cancel' | null>(null);

  const toggleWatch = async () => {
    setBusy('watch');
    try {
      await setWatchingBack(uid, item, !state.watchingBack);
      toast.success(
        state.watchingBack ? 'You won’t be notified' : 'We’ll let you know when it’s back'
      );
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const cancelRequest = async () => {
    if (!state.myRequest) return;
    setBusy('cancel');
    try {
      await api.cancelRequest({ loanId: state.myRequest.id });
      toast.success('Request cancelled');
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const message = () =>
    ownerPhone &&
    openWhatsApp(ownerPhone, aboutBookMessage({ ownerName: profile?.name, title: item.title }));

  let hero: ReactNode;
  const openLoan = (loanId: string) =>
    router.push({ pathname: '/loan/[loanId]', params: { loanId } });
  const messageAgain = () =>
    ownerPhone && openWhatsApp(ownerPhone, requestFollowUpMessage(profile?.name, item.title));

  if (state.myBorrow) {
    // F6 / E4: "Pick up from Ravi" for 48 h after the accept, then "With you · due 12 Dec".
    const pickup = myBorrowLoan ? inPickupWindow(myBorrowLoan) : false;
    hero = (
      <StatusHero
        icon={HandHelping}
        tone="info"
        title={
          state.myBorrow.status === 'returnPending'
            ? `Waiting for ${ownerName} to confirm`
            : pickup
              ? `Pick up from ${ownerName}`
              : 'With you'
        }
        detail={
          state.myBorrow.status === 'returnPending'
            ? 'You said you returned it'
            : pickup
              ? profile?.pickupNote
                ? `${ownerName} said yes · pickup: ${profile.pickupNote}`
                : `${ownerName} said yes`
              : myBorrowLoan?.dueDate
                ? capitalize(dueLabel(myBorrowLoan.dueDate))
                : null
        }
      />
    );
  } else if (state.myRequest) {
    hero = (
      <StatusHero
        icon={Clock}
        tone="warning"
        title="Request sent"
        detail={`${ownerName} can answer in LendShelf`}
      />
    );
  } else if (state.status.kind === 'available') {
    hero = (
      <StatusHero
        icon={HandHelping}
        tone="success"
        title="Available to borrow"
        detail={`${ownerName} is happy to lend this one`}
      />
    );
  } else if (state.status.kind === 'lent') {
    const label = backLabel(state.status.dueDate);
    hero = (
      <StatusHero
        icon={Clock}
        tone="muted"
        title="Lent"
        detail={label === 'lent out' ? null : capitalize(label)}
      />
    );
  } else {
    hero = (
      <StatusHero
        icon={BookLock}
        tone="muted"
        title="Not lending"
        detail={`${ownerName} has it but isn’t lending it right now`}
      />
    );
  }

  return (
    <View className="gap-6">
      <Card className="gap-4 px-4 py-4">
        {hero}
        <View className="gap-2">
          {state.canAsk ? (
            <Button
              size="lg"
              onPress={() =>
                setAskTarget({
                  itemId: item.id,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  ownerName,
                  ownerId: item.ownerId,
                })
              }
            >
              <Icon as={HandHelping} size={18} className="text-primary-foreground" />
              <Text>Ask to borrow</Text>
            </Button>
          ) : null}
          {state.myBorrow ? (
            <Button size="lg" onPress={() => openLoan(state.myBorrow!.id)}>
              <Icon as={ArrowRight} size={16} className="text-primary-foreground" />
              <Text>Open loan</Text>
            </Button>
          ) : null}
          {state.myRequest && ownerPhone ? (
            <Button variant="outline" onPress={messageAgain}>
              <Icon as={MessageCircle} size={16} />
              <Text>Message {firstName(ownerName)} again</Text>
            </Button>
          ) : null}
          {state.myRequest ? (
            <View className="flex-row gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onPress={() => openLoan(state.myRequest!.id)}
              >
                <Text>Open request</Text>
              </Button>
              <ConfirmButton
                label={busy === 'cancel' ? 'Cancelling…' : 'Cancel request'}
                variant="ghost"
                size="default"
                className="flex-1"
                busy={busy === 'cancel'}
                title="Cancel your request?"
                description={`${ownerName} won’t see your request for “${item.title}” any more.`}
                confirmLabel="Cancel request"
                destructive
                onConfirm={() => void cancelRequest()}
              />
            </View>
          ) : null}
          {state.canNotifyBack ? (
            <Button
              variant={state.watchingBack ? 'secondary' : 'outline'}
              onPress={toggleWatch}
              disabled={busy === 'watch'}
            >
              <Icon as={state.watchingBack ? BellOff : BellRing} size={16} />
              <Text>{state.watchingBack ? 'Stop notifying me' : 'Notify me when it’s back'}</Text>
            </Button>
          ) : null}
          {state.canMessage && !state.myRequest && !state.myBorrow ? (
            <Button variant="outline" onPress={message}>
              <Icon as={MessageCircle} size={16} />
              <Text>Message {firstName(ownerName)} on WhatsApp</Text>
            </Button>
          ) : null}
        </View>
      </Card>

      <View>
        <SectionHeader title="Owner" />
        <Card className="gap-0 py-0">
          <ListRow
            onPress={() =>
              router.push({ pathname: '/person/[uid]', params: { uid: item.ownerId } })
            }
            leading={<PersonAvatar name={ownerName} />}
            title={ownerName}
            subtitle={
              profile?.pickupNote ? `Pickup: ${profile.pickupNote}` : 'See their other books'
            }
            trailing={<Icon as={ChevronRight} size={16} className="text-muted-foreground" />}
          />
        </Card>
      </View>

      <AskDialog target={askTarget} onOpenChange={(open) => !open && setAskTarget(null)} />
    </View>
  );
}

/**
 * Copy page for a book I have right now when the copy itself can't be read (the owner hid it,
 * moved it to a private collection, I don't have them saved, or it was removed). Built from the
 * loan's denormalised title/cover/owner name, with the borrower actions.
 */
export function BorrowedLoanFallback({
  loan,
  ownerName,
  ownerPhone,
}: {
  loan: WithId<Loan>;
  ownerName: string;
  ownerPhone: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const pending = loan.status === 'returnPending';

  const markReturned = async () => {
    setBusy(true);
    try {
      await api.markReturned({ loanId: loan.id });
      toast.success(`Thanks! ${firstName(ownerName)} will confirm`);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const message = () =>
    ownerPhone &&
    openWhatsApp(ownerPhone, returnMessage({ ownerName: loan.ownerName, title: loan.title }));

  return (
    <View className="w-full max-w-2xl gap-6 self-center">
      <View className="flex-row gap-4">
        <BookCover uri={loan.coverUrl} title={loan.title} size="md" />
        <View className="flex-1 justify-center gap-1.5">
          <Text className="text-xl font-bold leading-6 tracking-tight" numberOfLines={3}>
            {loan.title}
          </Text>
          <Text className="text-sm text-muted-foreground">Borrowed from {ownerName}</Text>
        </View>
      </View>

      <Card className="gap-4 px-4 py-4">
        <StatusHero
          icon={HandHelping}
          tone="info"
          title={
            pending
              ? `Waiting for ${ownerName} to confirm`
              : inPickupWindow(loan)
                ? `Pick up from ${ownerName}`
                : 'With you'
          }
          detail={
            pending
              ? `Waiting for ${ownerName} to confirm the return`
              : loan.dueDate
                ? capitalize(dueLabel(loan.dueDate))
                : null
          }
        />
        <View className="gap-2">
          {pending ? null : (
            <ConfirmButton
              label="I’ve returned it"
              icon={PackageCheck}
              variant="default"
              size="lg"
              busy={busy}
              title="Returned it?"
              description={`${ownerName} will be asked to confirm they have “${loan.title}” back.`}
              confirmLabel="Yes, I’ve returned it"
              onConfirm={() => void markReturned()}
            />
          )}
          {ownerPhone ? (
            <Button variant="outline" onPress={message}>
              <Icon as={MessageCircle} size={16} />
              <Text>Message {firstName(ownerName)}</Text>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onPress={() => router.push({ pathname: '/loan/[loanId]', params: { loanId: loan.id } })}
          >
            <Text>Open loan</Text>
          </Button>
        </View>
      </Card>
    </View>
  );
}
