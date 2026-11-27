/**
 * Confirm sheets, the due-date sheet and WhatsApp success sheets for loan actions (UX §F3, §F7).
 * One hook so the Needs-you card, the Loans rows and the Loan screen behave the same:
 *
 *   const sheets = useLoanSheets();
 *   sheets.confirm('gotItBack', loan);   // one-step confirm sheet
 *   sheets.gotItBackNow(loan);           // one tap (only on the says-returned card)
 *   return <>{…}{sheets.element}</>;
 */
import { CheckCircle2, MessageCircle } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { DueDateDialog } from '@/features/loans/due-date-dialog';
import { dueDateParam } from '@/features/loans/due-dates';
import {
  acceptedMessage,
  declinedMessage,
  dueChangedMessage,
  notBackYetMessage,
  openWhatsApp,
  requestReplyMessage,
  wentElsewhereMessage,
} from '@/features/loans/messages';
import {
  acceptAlreadyDone,
  acceptDeclinesWarning,
  DECLINE_REASONS,
  otherRequestsForCopy,
} from '@/features/loans/requests';
import {
  STALE_CODES,
  staleOutcome,
  type StaleAction,
  type StaleOutcome,
} from '@/features/loans/stale';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import { askForPushInContext } from '@/features/push-ask/ask';
import { updateItemVisibility } from '@/features/shared/mutations';
import { useMyProfile } from '@/hooks/use-auth';
import { useMyLoans } from '@/hooks/use-loans';
import { api } from '@/lib/api';
import { formatShortDate } from '@/lib/dates';
import { errorCode } from '@/lib/errors';
import { db, doc, getDoc } from '@/lib/firebase';
import { announce, sentences } from '@/lib/a11y';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useDismissedStore } from '@/stores/dismissed';
import { Input } from '@/components/ui/input';
import { COLLECTIONS, LIMITS, type DeclineReason, type Loan, type WithId } from '@/types/model';
import { joinNames, shortName } from '@/features/shared/people';
import { useSessionStore } from '@/stores/session';

type L = WithId<Loan>;

/** Dismissed-store key for the accept sheet's pickup-note prompt ("Don't ask again"). */
const PICKUP_PROMPT_KEY = 'pickupPrompt';
/** "Kabir cancelled this request" explains why a sheet closed, so it stays up longer. */
const STALE_TOAST_MS = 6000;
/** The same stale message within this window is shown once (live check + failed call, QA). */
const STALE_DEDUPE_MS = 10_000;

export type ConfirmKind =
  'gotItBack' | 'notBackYet' | 'notCollected' | 'markReturned' | 'cancelRequest' | 'decline';

interface SuccessSheet {
  title: string;
  description: string | null;
  phone: string | null;
  message: string;
  whatsappLabel: string;
  /** WhatsApp as the filled primary (Accept, due date) or as an outline secondary (Not back yet). */
  whatsappPrimary: boolean;
  /** More outline WhatsApp hand-offs, e.g. "Tell Kabir on WhatsApp" after lending to Asha (E5). */
  extra?: { key: string; label: string; phone: string; message: string }[];
}

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const first = shortName;

/** The WhatsApp-green button used for every hand-off (F7). */
export function WhatsAppButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  className,
}: {
  label: string;
  onPress(): void;
  variant?: 'primary' | 'outline';
  size?: 'default' | 'lg';
  className?: string;
}) {
  if (variant === 'outline') {
    return (
      <Button variant="outline" size={size} onPress={onPress} className={className}>
        <Icon as={MessageCircle} size={16} className="text-[#128C7E] dark:text-[#25D366]" />
        <Text>{label}</Text>
      </Button>
    );
  }
  return (
    <Button
      size={size}
      onPress={onPress}
      className={cn('bg-[#25D366] active:bg-[#1ebe5b]', className)}
    >
      <Icon as={MessageCircle} size={16} className="text-white" />
      <Text className="text-white">{label}</Text>
    </Button>
  );
}

export function useLoanSheets() {
  const people = useLoanPeople();
  const { profile: me } = useMyProfile();
  const uid = useSessionStore((st) => st.user?.uid);
  const { incomingRequests, asOwner, asBorrower } = useMyLoans();
  const [confirmState, setConfirmState] = useState<{ kind: ConfirmKind; loan: L } | null>(null);
  /** `others`: the other open requests for the copy when accepting (the server declines them). */
  const [due, setDue] = useState<{ mode: 'accept' | 'change'; loan: L; others: L[] } | null>(null);
  /** E5 step 2 / E13 (QA B7): "Where can they pick it up?" while my pickup note is empty. */
  const [pickupDraft, setPickupDraft] = useState('');
  const pickupDismissed = useDismissedStore((st) => st.keys.includes(PICKUP_PROMPT_KEY));
  /** One request, or every request for a copy ("Decline all" in the chooser, E5). */
  const [declining, setDeclining] = useState<L[] | null>(null);
  const [success, setSuccess] = useState<SuccessSheet | null>(null);
  /** The loan whose action is running, and which action (the spinner goes on that button, QA B11). */
  const [busy, setBusy] = useState<{ id: string; kind: ConfirmKind | 'accept' } | null>(null);
  const busyId = busy?.id ?? null;
  const setBusyId = (id: string | null, kind: ConfirmKind | 'accept' = 'decline') =>
    setBusy(id ? { id, kind } : null);
  /** Loans I'm acting on right now: their live change is mine, not a stale sheet. */
  const [mine, setMine] = useState<ReadonlySet<string>>(() => new Set());
  const markMine = (ids: string[], on: boolean) =>
    setMine((cur) => {
      const next = new Set(cur);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const closeSheets = () => {
    setConfirmState(null);
    setDue(null);
    setDeclining(null);
  };

  /** The last stale message shown, so the live check and the failed call don't both toast it. */
  const lastStale = useRef<{ key: string; at: number } | null>(null);

  /** "Kabir cancelled this request" (+ "Message Zoya" when it expired), after closing the sheet. */
  const showStale = (outcome: StaleOutcome, loan: L) => {
    const key = `${loan.id}:${outcome.text}`;
    const now = Date.now();
    if (lastStale.current?.key === key && now - lastStale.current.at < STALE_DEDUPE_MS) return;
    lastStale.current = { key, at: now };
    const phone = people.phone(loan);
    const label = `Message ${first(people.name(loan))}`;
    announce(outcome.text);
    if (outcome.message && phone) {
      toast.info(outcome.text, {
        duration: STALE_TOAST_MS,
        action: {
          label,
          onClick: () =>
            void openWhatsApp(phone, requestReplyMessage(people.greetName(loan), loan.title)),
        },
      });
    } else {
      // The toast is the only explanation of why the sheet closed, so it stays longer.
      toast.info(outcome.text, { duration: STALE_TOAST_MS });
    }
  };

  /**
   * After a failed call: if the loan changed under the sheet (cancelled, expired, answered),
   * close the sheets and say what happened (QA B3, E5). Returns false for other errors.
   */
  const resolveStale = async (e: unknown, loan: L, action: StaleAction): Promise<boolean> => {
    const code = errorCode(e);
    if (!code || !STALE_CODES.includes(code)) return false;
    const fresh = await getDoc(doc(db, COLLECTIONS.loans, loan.id))
      .then((snap) => snap.data() as Loan | undefined)
      .catch(() => undefined);
    const outcome = staleOutcome(action, fresh, {
      role: loan.ownerId === uid ? 'owner' : 'borrower',
      other: people.name(loan),
    });
    if (!outcome) return false;
    closeSheets();
    showStale(outcome, loan);
    return true;
  };

  // Live: the loan behind an open sheet changed elsewhere (Kabir cancelled while I was
  // deciding): close the sheet and say so, before any tap (E5 "the card animates away").
  const open: { loan: L; action: StaleAction } | null = confirmState
    ? { loan: confirmState.loan, action: confirmState.kind }
    : due
      ? { loan: due.loan, action: due.mode === 'accept' ? 'accept' : 'changeDue' }
      : declining?.length === 1
        ? { loan: declining[0]!, action: 'decline' }
        : null;
  const live = open
    ? ([...asOwner, ...asBorrower].find((l) => l.id === open.loan.id) ?? null)
    : null;
  const liveOutcome =
    open && live && !mine.has(live.id)
      ? staleOutcome(open.action, live, {
          role: live.ownerId === uid ? 'owner' : 'borrower',
          other: people.name(live),
        })
      : null;
  const liveKey = liveOutcome && live ? `${live.id}:${live.status}:${liveOutcome.text}` : null;
  /** The open sheet's loan changed elsewhere: the sheet is shown closed (state is replaced on the next open). */
  const staleOpen = !!liveOutcome;
  useEffect(() => {
    if (!liveKey || !liveOutcome || !live) return;
    showStale(liveOutcome, live);
    // Keyed on the change itself; the helpers are stable enough for a one-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);
  // C11: after an accept, ask about notifications once the success sheet is closed (one sheet
  // at a time).
  const askAfterSuccess = useRef<(() => void) | null>(null);
  // F8: the sheet's new state (Lent to Asha, Declined, …) is announced.
  useEffect(() => {
    if (success) announce(sentences([success.title, success.description]));
  }, [success]);
  useEffect(() => {
    if (success || !askAfterSuccess.current) return;
    const ask = askAfterSuccess.current;
    askAfterSuccess.current = null;
    ask();
  }, [success]);

  /** "Lent to Asha · due 12 Dec" + Tell Asha (P) + Tell Kabir (S) for each declined requester. */
  const acceptedSheet = (
    loan: L,
    date: Date,
    others: readonly L[],
    note?: string
  ): SuccessSheet => {
    const name = people.name(loan);
    const declined = others.length
      ? ` ${others.length === 1 ? 'The other request was' : 'The other requests were'} declined.`
      : ' Agree the pick-up on WhatsApp.';
    return {
      title: `Lent to ${name} · due ${formatShortDate(date)}`,
      // F7: the app can't know whether push is on, so no claim that a notification arrived.
      description: `${first(name)} can see it in LendShelf.${declined}`,
      phone: people.phone(loan),
      message: acceptedMessage({
        borrowerName: people.greetName(loan),
        title: loan.title,
        dueDate: date,
        pickupNote: note || me?.pickupNote,
      }),
      whatsappLabel: `Tell ${first(name)} on WhatsApp`,
      whatsappPrimary: true,
      extra: others.flatMap((o) => {
        const phone = people.phone(o);
        if (!phone) return [];
        return [
          {
            key: o.id,
            label: `Tell ${first(people.name(o))} on WhatsApp`,
            phone,
            message: wentElsewhereMessage({
              borrowerName: people.greetName(o),
              title: o.title,
              backAround: date,
            }),
          },
        ];
      }),
    };
  };

  /**
   * The decline sheet's action: decline each request with the reason, optionally stop lending
   * the copy. Several loans: "Decline all" from the chooser (E5).
   */
  const decline = async (loans: L[], reason: DeclineReason | null, stopLending: boolean) => {
    const loan = loans[0]!;
    setBusyId(loan.id, 'decline');
    markMine(
      loans.map((l) => l.id),
      true
    );
    try {
      const results = await Promise.allSettled(
        loans.map((l) =>
          api.respondToRequest({ loanId: l.id, accept: false, ...(reason ? { reason } : {}) })
        )
      );
      const failed = results.flatMap((r, i) =>
        r.status === 'rejected' ? [{ e: r.reason as unknown, l: loans[i]! }] : []
      );
      if (failed.length === loans.length) throw failed[0]!.e;
      const declined = loans.filter((l) => !failed.some((x) => x.l.id === l.id));
      let stopped = false;
      if (stopLending) {
        // "Also stop lending this copy" (E5). Not lending stays visible, so sharing is unchanged.
        const snap = await getDoc(doc(db, COLLECTIONS.items, loan.itemId));
        const item = snap.data() as
          { visibility?: string; sharedWithContacts?: boolean } | undefined;
        if (item?.visibility === 'lendable') {
          await updateItemVisibility(loan.itemId, 'visible', !!item.sharedWithContacts);
          stopped = true;
        }
      }
      const lead = declined[0]!;
      const names = joinNames(declined.map((l) => first(people.name(l))));
      setSuccess({
        title: 'Declined',
        // F7: the app can't know whether push is on, so it doesn't claim they were told.
        description: `${names} can see it in LendShelf${stopped ? '. This copy is now Not lending' : ''}.`,
        phone: people.phone(lead),
        message: declinedMessage({
          borrowerName: people.greetName(lead),
          title: lead.title,
          reason,
        }),
        whatsappLabel: `Tell ${first(people.name(lead))} on WhatsApp`,
        whatsappPrimary: false,
        extra: declined.slice(1).flatMap((o) => {
          const phone = people.phone(o);
          if (!phone) return [];
          return [
            {
              key: o.id,
              label: `Tell ${first(people.name(o))} on WhatsApp`,
              phone,
              message: declinedMessage({
                borrowerName: people.greetName(o),
                title: o.title,
                reason,
              }),
            },
          ];
        }),
      });
      // Some of several were already gone (cancelled meanwhile): say so too.
      for (const x of failed) {
        if (!(await resolveStale(x.e, x.l, 'decline'))) toastError(x.e);
      }
    } catch (e) {
      markMine(
        loans.map((l) => l.id),
        false
      );
      // Cancelled or expired meanwhile: the sheet closes with the reason in words (QA B3).
      if (await resolveStale(e, loan, 'decline')) return;
      toastError(e);
      throw e;
    } finally {
      setBusyId(null);
    }
  };

  const perform = async (kind: ConfirmKind, loan: L): Promise<void> => {
    const name = people.name(loan);
    setBusyId(loan.id, kind);
    markMine([loan.id], true);
    try {
      switch (kind) {
        case 'gotItBack':
          await api.confirmReturn({ loanId: loan.id, reason: 'returned' });
          toast.success('Back on your shelf', {
            description: `“${loan.title}” is available again.`,
          });
          break;
        case 'notCollected':
          await api.confirmReturn({ loanId: loan.id, reason: 'notCollected' });
          toast.success('Closed as not collected', {
            description: `“${loan.title}” is available again.`,
          });
          break;
        case 'notBackYet': {
          await api.markNotReturned({ loanId: loan.id });
          const phone = people.phone(loan);
          setSuccess({
            title: 'Marked as not back yet',
            // F7: no claim about delivery; the borrower's Loan screen shows it either way (QA B1).
            description: `The loan is open again. ${first(name)} can see it in LendShelf.`,
            phone,
            message: notBackYetMessage({ borrowerName: people.greetName(loan), title: loan.title }),
            whatsappLabel: `Message ${first(name)} on WhatsApp`,
            whatsappPrimary: false,
          });
          break;
        }
        case 'markReturned':
          await api.markReturned({ loanId: loan.id });
          toast.success(`Thanks! ${first(name)} will confirm`);
          break;
        case 'cancelRequest':
          await api.cancelRequest({ loanId: loan.id });
          toast.success('Request cancelled');
          break;
        case 'decline':
          // `confirm('decline')` opens the decline sheet with reasons; this is a plain fallback.
          await api.respondToRequest({ loanId: loan.id, accept: false });
          toast.success('Declined');
          break;
      }
    } catch (e) {
      markMine([loan.id], false);
      if (await resolveStale(e, loan, kind)) return;
      // F4: network errors get a Retry.
      toastError(e, undefined, { retry: () => void perform(kind, loan) });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDue = async (date: Date) => {
    if (!due) return;
    const { loan, mode, others } = due;
    const name = people.name(loan);
    const phone = people.phone(loan);
    markMine([loan.id], true);
    try {
      if (mode === 'accept') {
        // Save a pickup note typed in the sheet first, so the WhatsApp text can include it.
        const note = pickupDraft.trim();
        if (note && me?.name && !me.pickupNote?.trim()) {
          await api.completeProfile({ name: me.name, pickupNote: note }).catch(() => undefined);
        }
        await api.respondToRequest({ loanId: loan.id, accept: true, dueDate: dueDateParam(date) });
        askAfterSuccess.current = () =>
          void askForPushInContext('accept', { name, title: loan.title });
        setSuccess(acceptedSheet(loan, date, others, note));
      } else {
        await api.updateDueDate({ loanId: loan.id, dueDate: dueDateParam(date) });
        setSuccess({
          title: `Due date moved to ${formatShortDate(date)}`,
          description: `“${loan.title}” is now due back ${formatShortDate(date)}.`,
          phone,
          message: dueChangedMessage({
            borrowerName: people.greetName(loan),
            title: loan.title,
            dueDate: date,
            previousDue: loan.dueDate,
          }),
          whatsappLabel: `Tell ${first(name)} on WhatsApp`,
          whatsappPrimary: true,
        });
      }
    } catch (e) {
      const code = errorCode(e);
      if (mode === 'accept' && code === 'failed-precondition') {
        // A retry after a lost response (E5): the first accept may have gone through. If this
        // loan is now active, the copy is out because of this very loan: show the success sheet.
        const fresh = await getDoc(doc(db, COLLECTIONS.loans, loan.id)).catch(() => null);
        const data = fresh?.data() as Loan | undefined;
        if (acceptAlreadyDone(data)) {
          setSuccess(acceptedSheet(loan, data?.dueDate?.toDate() ?? date, others));
          return;
        }
      }
      markMine([loan.id], false);
      // Expired, cancelled or already answered: close with the reason in words (QA B3, E5).
      if (await resolveStale(e, loan, mode === 'accept' ? 'accept' : 'changeDue')) return;
      toastError(e);
      // An expired or already-handled request can't be retried: close the dialog.
      if (code !== 'failed-precondition' && code !== 'not-found') throw e;
    }
  };

  const c = confirmState
    ? confirmCopy(confirmState.kind, confirmState.loan, people.name(confirmState.loan))
    : null;

  const element = (
    <>
      <AlertDialog
        open={!!confirmState && !staleOpen}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
      >
        {confirmState && c ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{c.title}</AlertDialogTitle>
              {c.description ? (
                <AlertDialogDescription>{c.description}</AlertDialogDescription>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text>{c.cancel}</Text>
              </AlertDialogCancel>
              <AlertDialogAction
                onPress={() => void perform(confirmState.kind, confirmState.loan)}
                variant={c.destructive ? 'destructive' : 'default'}
              >
                <Text>{c.confirm}</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>

      <DueDateDialog
        key={due ? `${due.loan.id}-${due.mode}` : 'closed'}
        open={!!due && !staleOpen}
        onOpenChange={(o) => !o && setDue(null)}
        mode={due?.mode ?? 'accept'}
        title={
          due?.mode === 'change' ? 'Change due date' : `Lend to ${due ? people.name(due.loan) : ''}`
        }
        description={due ? `When should “${due.loan.title}” come back?` : undefined}
        warning={
          due?.mode === 'accept'
            ? (acceptDeclinesWarning(due.others.map((o) => people.name(o))) ?? undefined)
            : undefined
        }
        currentDue={due?.loan.dueDate ?? null}
        confirmLabel={
          due?.mode === 'change'
            ? 'Save due date'
            : `Lend to ${due ? first(people.name(due.loan)) : ''}`
        }
        onConfirm={confirmDue}
      >
        {due?.mode === 'accept' && !me?.pickupNote?.trim() && !pickupDismissed ? (
          <View className="gap-1.5">
            <Text className="text-sm font-medium">Where can they pick it up?</Text>
            <Input
              value={pickupDraft}
              onChangeText={(t) => setPickupDraft(t.slice(0, LIMITS.pickupNote))}
              placeholder="e.g. Koramangala, weekends"
              accessibilityLabel="Where can they pick it up?"
              maxLength={LIMITS.pickupNote}
            />
            <Pressable
              onPress={() => useDismissedStore.getState().dismiss(PICKUP_PROMPT_KEY)}
              accessibilityRole="button"
              className="min-h-11 justify-center self-start"
            >
              <Text className="text-sm text-muted-foreground underline">Don’t ask again</Text>
            </Pressable>
          </View>
        ) : null}
      </DueDateDialog>

      <DeclineDialog
        key={`decline-${declining?.map((l) => l.id).join(',') ?? 'closed'}`}
        loans={staleOpen ? null : declining}
        names={declining?.map((l) => people.name(l)) ?? []}
        onClose={() => setDeclining(null)}
        onDecline={decline}
      />

      <Dialog open={!!success} onOpenChange={(o) => !o && setSuccess(null)}>
        {success ? (
          <DialogContent className="w-[22rem] max-w-full">
            <DialogHeader className="items-center">
              <View className="size-12 items-center justify-center rounded-full bg-emerald-500/15">
                <Icon
                  as={CheckCircle2}
                  size={24}
                  className="text-emerald-600 dark:text-emerald-400"
                />
              </View>
              <DialogTitle className="text-center">{success.title}</DialogTitle>
              {success.description ? (
                <DialogDescription className="text-center">{success.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              {success.phone ? (
                <WhatsAppButton
                  label={success.whatsappLabel}
                  variant={success.whatsappPrimary ? 'primary' : 'outline'}
                  onPress={() => {
                    const { phone, message, extra } = success;
                    // Keep the sheet open while others still need telling (E5).
                    if (!extra?.length) setSuccess(null);
                    if (phone) void openWhatsApp(phone, message);
                  }}
                />
              ) : null}
              {success.extra?.map((x) => (
                <WhatsAppButton
                  key={x.key}
                  label={x.label}
                  variant="outline"
                  onPress={() => void openWhatsApp(x.phone, x.message)}
                />
              ))}
              <Button
                size="lg"
                variant={success.phone && success.whatsappPrimary ? 'outline' : 'default'}
                onPress={() => setSuccess(null)}
              >
                <Text>Done</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );

  return {
    /** Loan id whose action is running (show a spinner, disable its buttons). */
    busyId,
    /** Which action is running on `busyId` (only its button shows the spinner, QA B11). */
    busyKind: busy?.kind ?? null,
    /** Opens the one-step confirm sheet for `kind` ('decline' opens the sheet with reasons). */
    confirm: (kind: ConfirmKind, loan: L) =>
      kind === 'decline' ? setDeclining([loan]) : setConfirmState({ kind, loan }),
    /** "Decline all" from the request chooser: one sheet, one reason for everyone (E5). */
    declineAll: (loans: L[]) => {
      if (loans.length) setDeclining(loans);
    },
    /** Got it back without a sheet: only on the says-returned card (both sides agree). */
    gotItBackNow: (loan: L) => void perform('gotItBack', loan),
    /** Accept a request: the due-date sheet is the confirm (E5). */
    accept: (loan: L) =>
      setDue({ mode: 'accept', loan, others: otherRequestsForCopy(loan, incomingRequests) }),
    changeDue: (loan: L) => setDue({ mode: 'change', loan, others: [] }),
    // Nothing is rendered while every sheet is closed, so it never adds spacing to a gap layout.
    element: confirmState || due || declining || success ? element : null,
  };
}

export type LoanSheets = ReturnType<typeof useLoanSheets>;

/**
 * Decline sheet (E5): optional reason chips; "Not lending this one" adds "Also stop lending this
 * copy". Remount (via `key`) to reset it.
 */
function DeclineDialog({
  loans,
  names,
  onClose,
  onDecline,
}: {
  /** One request, or all requests for a copy ("Decline all"). */
  loans: L[] | null;
  names: string[];
  onClose(): void;
  /** Resolve to close; throw to keep the sheet open. */
  onDecline(loans: L[], reason: DeclineReason | null, stopLending: boolean): Promise<void>;
}) {
  const [reason, setReason] = useState<DeclineReason | null>(null);
  const [stopLending, setStopLending] = useState(false);
  const [busy, setBusy] = useState(false);
  const loan = loans?.[0] ?? null;
  const many = (loans?.length ?? 0) > 1;
  const person = joinNames(names.map((n) => first(n)));

  const submit = async () => {
    if (!loans?.length) return;
    setBusy(true);
    announce('Declining…');
    try {
      await onDecline(loans, reason, reason === 'notLending' && stopLending);
      onClose();
    } catch {
      // The error toast is already shown; keep the sheet open to retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!loan} onOpenChange={(o) => !o && !busy && onClose()}>
      {loan ? (
        <DialogContent className="w-[22rem] max-w-full gap-4">
          <DialogHeader>
            <DialogTitle>
              {many ? `Decline all ${loans!.length} requests?` : `Decline ${person}’s request?`}
            </DialogTitle>
            <DialogDescription>
              {`${person} ${many ? 'are' : 'is'} told in LendShelf that you can’t lend “${loan.title}”. Add a reason if you like.`}
            </DialogDescription>
          </DialogHeader>
          <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Reason">
            {DECLINE_REASONS.map((r) => {
              const selected = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(selected ? null : r.value)}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: busy }}
                  className={cn(
                    'min-h-11 justify-center rounded-lg border px-3.5 py-2',
                    selected
                      ? 'border-primary bg-primary'
                      : 'border-border bg-background active:bg-accent dark:bg-input/30'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      selected ? 'text-primary-foreground' : 'text-foreground'
                    )}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {reason === 'notLending' ? (
            <Pressable
              onPress={() => setStopLending((v) => !v)}
              disabled={busy}
              accessibilityRole="switch"
              accessibilityLabel="Also stop lending this copy"
              accessibilityState={{ checked: stopLending }}
              aria-checked={stopLending}
              className="min-h-11 flex-row items-center gap-3 rounded-lg px-1"
            >
              {/* The whole row is the switch: the visual Switch takes no presses of its own. */}
              <View
                pointerEvents="none"
                importantForAccessibility="no-hide-descendants"
                aria-hidden
              >
                <Switch checked={stopLending} onCheckedChange={setStopLending} disabled={busy} />
              </View>
              <Text className="flex-1 text-sm">Also stop lending this copy</Text>
            </Pressable>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onPress={onClose} disabled={busy}>
              <Text>Cancel</Text>
            </Button>
            <Button variant="destructive" onPress={() => void submit()} disabled={busy}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : null}
              <Text className="text-white">{busy ? 'Declining…' : 'Decline'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/** Copy for each confirm sheet (E4, E6). */
export function confirmCopy(
  kind: ConfirmKind,
  loan: Pick<Loan, 'title' | 'status'> & Partial<Pick<Loan, 'borrowerUid'>>,
  other: string
): {
  title: string;
  description: string | null;
  confirm: string;
  cancel: string;
  destructive?: boolean;
} {
  const name = first(other);
  const title = `“${loan.title}”`;
  switch (kind) {
    case 'gotItBack':
      return {
        title: `Got ${title} back from ${name}?`,
        description:
          // A borrower who isn't on LendShelf can't say they returned it (QA friction).
          loan.status === 'returnPending' || loan.borrowerUid === null
            ? 'It goes back on your shelf and the loan closes.'
            : `${name} hasn’t said they returned it. It goes back on your shelf and the loan closes.`,
        confirm: 'Yes, it’s back',
        cancel: 'Cancel',
      };
    case 'notBackYet':
      return {
        title: `Tell ${name} you haven’t got ${title} back?`,
        description: 'The loan stays open and due-date reminders start again.',
        confirm: 'Not back yet',
        cancel: 'Cancel',
      };
    case 'notCollected':
      return {
        title: 'Close this loan as not collected?',
        description: `Use this if ${name} never picked up ${title}. It’s available again, and ${name} isn’t asked for a review.`,
        confirm: 'Close loan',
        cancel: 'Cancel',
      };
    case 'markReturned':
      return {
        title: `Did you give ${title} back to ${name}?`,
        description: `${name} will be asked to confirm they have it.`,
        confirm: 'Yes, I’ve returned it',
        cancel: 'Not yet',
      };
    case 'cancelRequest':
      return {
        title: 'Cancel your request?',
        description: `${name} won’t see your request for ${title} any more.`,
        confirm: 'Cancel request',
        cancel: 'Keep it',
        destructive: true,
      };
    case 'decline':
      return {
        title: 'Decline this request?',
        description: `${name} will be told you can’t lend ${title} right now.`,
        confirm: 'Decline',
        cancel: 'Cancel',
        destructive: true,
      };
  }
}
