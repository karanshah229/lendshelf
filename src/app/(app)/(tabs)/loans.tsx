import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  History,
  Inbox,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  bucketLoans,
  canOpenCopy,
  initialSegment,
  type LoanSegment,
} from '@/features/loans/buckets';
import { DueDateDialog } from '@/features/loans/due-date-dialog';
import { dueDateParam } from '@/features/loans/due-dates';
import {
  BorrowedCard,
  HistoryRow,
  IncomingRequestCard,
  LentCard,
  OutgoingRequestCard,
} from '@/features/loans/loan-cards';
import {
  openWhatsApp,
  requestFollowUpMessage,
  requestReplyMessage,
} from '@/features/loans/messages';
import { Segmented } from '@/features/loans/segmented';
import { useLinkMap } from '@/hooks/use-links';
import { useMyLoans } from '@/hooks/use-loans';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';
import { errorCode } from '@/lib/errors';
import { toast, toastError } from '@/lib/toast';
import { nudgeMessage, returnMessage } from '@/lib/whatsapp';
import { useSessionStore } from '@/stores/session';
import type { Loan, WithId } from '@/types/model';

type L = WithId<Loan>;

const SEGMENTS: readonly LoanSegment[] = ['requests', 'lent', 'borrowed'];
const HISTORY_PAGE = 15;

type DueDialog = { loan: L; mode: 'accept' | 'change' } | null;

function SectionTitle({ children, count }: { children: string; count?: number }) {
  return (
    <View className="flex-row items-center gap-2 px-1 pb-1 pt-2">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </Text>
      {count ? <Text className="text-xs text-muted-foreground">· {count}</Text> : null}
    </View>
  );
}

export default function LoansScreen() {
  // Not useUid(): this tab can render once more while signing out.
  const uid = useSessionStore((s) => s.user?.uid) ?? '';
  const params = useLocalSearchParams<{ segment?: string }>();
  const { asOwner, asBorrower, loading, error } = useMyLoans();
  const linkMap = useLinkMap();
  const buckets = useMemo(() => bucketLoans(uid, asOwner, asBorrower), [uid, asOwner, asBorrower]);

  // Pick the first segment once the data is in; after that the user is in charge.
  // A `?segment=` param (e.g. from a notification) wins whenever it changes.
  const requested = SEGMENTS.find((s) => s === params.segment) ?? null;
  const [segment, setSegment] = useState<LoanSegment | null>(requested);
  const [lastRequested, setLastRequested] = useState(requested);
  if (requested !== lastRequested) {
    setLastRequested(requested);
    if (requested) setSegment(requested);
  }
  if (segment === null && !loading) setSegment(initialSegment(buckets));
  const current = segment ?? 'requests';

  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dueDialog, setDueDialog] = useState<DueDialog>(null);

  // ----- names (the name *I* saved them as, else the name on the loan) -----
  const borrowerName = useCallback(
    (l: L) => (l.borrowerUid && linkMap.get(l.borrowerUid)?.displayName) || l.borrowerName,
    [linkMap]
  );
  const ownerName = useCallback(
    (l: L) => linkMap.get(l.ownerId)?.displayName || l.ownerName,
    [linkMap]
  );
  const linkedOwners = useMemo(() => new Set(linkMap.keys()), [linkMap]);
  const openFor = (l: L) =>
    canOpenCopy(l, uid, linkedOwners)
      ? () => router.push({ pathname: '/copy/[itemId]', params: { itemId: l.itemId } })
      : undefined;

  // ----- actions -----
  const run = async (loanId: string, fn: () => Promise<unknown>, success: string) => {
    setBusy((b) => ({ ...b, [loanId]: true }));
    try {
      await fn();
      toast.success(success);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[loanId];
        return next;
      });
    }
  };

  const confirmDueDate = async (date: Date) => {
    if (!dueDialog) return;
    const { loan, mode } = dueDialog;
    const who = borrowerName(loan);
    try {
      if (mode === 'accept') {
        await api.respondToRequest({ loanId: loan.id, accept: true, dueDate: dueDateParam(date) });
        toast.success(`Lent to ${who}`, {
          description: `Due back ${formatShortDate(date)}. Arrange the handover on WhatsApp.`,
        });
      } else {
        await api.updateDueDate({ loanId: loan.id, dueDate: dueDateParam(date) });
        toast.success(`Due date moved to ${formatShortDate(date)}`);
      }
    } catch (e) {
      toastError(e);
      // An expired or already-handled request can't be retried: close the dialog.
      const code = errorCode(e);
      if (code !== 'failed-precondition' && code !== 'not-found') throw e;
    }
  };

  const decline = (l: L) =>
    run(l.id, () => api.respondToRequest({ loanId: l.id, accept: false }), 'Request declined');
  const cancel = (l: L) =>
    run(l.id, () => api.cancelRequest({ loanId: l.id }), 'Request cancelled');
  const confirmReturn = (l: L) =>
    run(l.id, () => api.confirmReturn({ loanId: l.id }), `“${l.title}” is back on your shelf`);
  const markReturned = (l: L) =>
    run(
      l.id,
      () => api.markReturned({ loanId: l.id }),
      `Thanks! ${ownerName(l).split(/\s+/)[0]} will confirm`
    );

  // ----- render helpers -----
  const segmentOptions = [
    {
      value: 'requests' as const,
      label: 'Requests',
      count: buckets.counts.requests,
      alert: buckets.incoming.length > 0,
    },
    { value: 'lent' as const, label: 'Lent out', count: buckets.counts.lent },
    { value: 'borrowed' as const, label: 'Borrowed', count: buckets.counts.borrowed },
  ];

  const header = (
    <>
      <ScreenHeader large title="Loans" />
      <View className="bg-background px-4 pb-3">
        <Segmented value={current} options={segmentOptions} onChange={setSegment} />
      </View>
    </>
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </View>
    );
  } else if (error) {
    body = (
      <EmptyState
        icon={Inbox}
        title="Couldn’t load your loans"
        description="Check your connection. Loans update by themselves when you’re back online."
      />
    );
  } else if (current === 'requests') {
    const empty = !buckets.incoming.length && !buckets.outgoing.length;
    body = (
      <View className="gap-3">
        {empty ? (
          <SegmentEmpty
            icon={Inbox}
            title="No requests"
            description="When someone asks to borrow one of your books, it shows up here. Your own requests do too."
          />
        ) : null}
        {buckets.incoming.length ? (
          <SectionTitle count={buckets.incoming.length}>Waiting for you</SectionTitle>
        ) : null}
        {buckets.incoming.map((l) => {
          const who = borrowerName(l);
          const phone = l.borrowerPhone;
          return (
            <IncomingRequestCard
              key={l.id}
              loan={l}
              borrower={who}
              busy={!!busy[l.id]}
              onOpen={openFor(l)}
              onAccept={() => setDueDialog({ loan: l, mode: 'accept' })}
              onDecline={() => void decline(l)}
              onMessage={
                phone
                  ? () => void openWhatsApp(phone, requestReplyMessage(who, l.title))
                  : undefined
              }
            />
          );
        })}
        {buckets.outgoing.length ? (
          <SectionTitle count={buckets.outgoing.length}>Your requests</SectionTitle>
        ) : null}
        {buckets.outgoing.map((l) => {
          const who = ownerName(l);
          const phone = l.ownerPhone;
          return (
            <OutgoingRequestCard
              key={l.id}
              loan={l}
              owner={who}
              busy={!!busy[l.id]}
              onOpen={openFor(l)}
              onCancel={() => void cancel(l)}
              onMessage={
                phone
                  ? () => void openWhatsApp(phone, requestFollowUpMessage(who, l.title))
                  : undefined
              }
            />
          );
        })}
        <HistorySection
          loans={buckets.history.requests}
          line={(l) =>
            l.ownerId === uid ? `${borrowerName(l)} asked` : `You asked ${ownerName(l)}`
          }
          openFor={openFor}
        />
      </View>
    );
  } else if (current === 'lent') {
    body = (
      <View className="gap-3">
        {buckets.lent.length ? null : (
          <SegmentEmpty
            icon={ArrowUpRight}
            title="Nothing lent out"
            description="Books you lend, through a request or by hand from a book’s page, show up here with their due dates."
          />
        )}
        {buckets.lent.map((l) => {
          const who = borrowerName(l);
          const phone = l.borrowerPhone;
          return (
            <LentCard
              key={l.id}
              loan={l}
              borrower={who}
              busy={!!busy[l.id]}
              onOpen={openFor(l)}
              onNudge={
                phone
                  ? () =>
                      void openWhatsApp(
                        phone,
                        nudgeMessage({ borrowerName: who, title: l.title, dueDate: l.dueDate })
                      )
                  : undefined
              }
              onConfirmReturn={() => void confirmReturn(l)}
              onChangeDue={() => setDueDialog({ loan: l, mode: 'change' })}
            />
          );
        })}
        <HistorySection
          loans={buckets.history.lent}
          line={(l) => `Lent to ${borrowerName(l)}`}
          openFor={openFor}
        />
      </View>
    );
  } else {
    body = (
      <View className="gap-3">
        {buckets.borrowed.length ? null : (
          <SegmentEmpty
            icon={ArrowDownLeft}
            title="Nothing borrowed"
            description="Find a book on Discover and ask to borrow it. Once the owner accepts, it shows up here."
          >
            <Button variant="outline" onPress={() => router.navigate('/')}>
              <Text>Go to Discover</Text>
            </Button>
          </SegmentEmpty>
        )}
        {buckets.borrowed.map((l) => {
          const who = ownerName(l);
          const phone = l.ownerPhone;
          return (
            <BorrowedCard
              key={l.id}
              loan={l}
              owner={who}
              busy={!!busy[l.id]}
              onOpen={openFor(l)}
              onMarkReturned={() => void markReturned(l)}
              onMessage={
                phone
                  ? () =>
                      void openWhatsApp(phone, returnMessage({ ownerName: who, title: l.title }))
                  : undefined
              }
            />
          );
        })}
        <HistorySection
          loans={buckets.history.borrowed}
          line={(l) => `Borrowed from ${ownerName(l)}`}
          openFor={openFor}
        />
      </View>
    );
  }

  return (
    <Screen safeBottom={false} header={header} className="pt-1">
      {body}
      <DueDateDialog
        key={dueDialog ? `${dueDialog.loan.id}-${dueDialog.mode}` : 'closed'}
        open={!!dueDialog}
        onOpenChange={(o) => !o && setDueDialog(null)}
        mode={dueDialog?.mode ?? 'accept'}
        title={
          dueDialog?.mode === 'change'
            ? 'Change due date'
            : `Lend to ${dueDialog ? borrowerName(dueDialog.loan) : ''}`
        }
        description={
          dueDialog?.mode === 'change'
            ? `When should “${dueDialog.loan.title}” come back?`
            : dueDialog
              ? `When should “${dueDialog.loan.title}” come back? Other requests for this copy are declined.`
              : undefined
        }
        currentDue={dueDialog?.loan.dueDate ?? null}
        confirmLabel={dueDialog?.mode === 'change' ? 'Save due date' : 'Accept'}
        onConfirm={confirmDueDate}
      />
    </Screen>
  );
}

function SegmentEmpty({
  icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <EmptyState icon={icon} title={title} description={description} className="py-10">
      {children}
    </EmptyState>
  );
}

function HistorySection({
  loans,
  line,
  openFor,
}: {
  loans: L[];
  line(l: L): string;
  openFor(l: L): (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(HISTORY_PAGE);
  if (!loans.length) return null;

  return (
    <View className="mt-3 overflow-hidden rounded-xl border border-border">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-3 px-4 py-3 active:bg-accent"
      >
        <Icon as={History} size={16} className="text-muted-foreground" />
        <Text className="flex-1 text-sm font-medium">History</Text>
        <Text className="text-xs text-muted-foreground">{loans.length}</Text>
        <Icon as={open ? ChevronUp : ChevronDown} size={16} className="text-muted-foreground" />
      </Pressable>
      {open ? (
        <View className="gap-0.5 border-t border-border px-3 py-2">
          {loans.slice(0, shown).map((l) => (
            <HistoryRow key={l.id} loan={l} line={line(l)} onOpen={openFor(l)} />
          ))}
          {loans.length > shown ? (
            <Button variant="ghost" size="sm" onPress={() => setShown((n) => n + HISTORY_PAGE)}>
              <Text>Show more</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
