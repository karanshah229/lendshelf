/**
 * What the Loan screen shows for one loan and one viewer (UX §D4 "Loan page", §E4 table):
 * the phase, the banner, one primary action per role, secondary/tertiary actions and the
 * timeline. Pure, so every state can be tested without Firebase.
 */
import { dueLabel, dueState, formatShortDate } from '@/lib/dates';
import type { Loan } from '@/types/model';

import { expiryLabel, isNotCollected } from '@/features/loans/buckets';
import { inPickupWindow, requestExpiresAt } from '@/features/loans/needs-you';
import { declinedLine } from '@/features/loans/requests';
import { shortName } from '@/features/shared/people';

export type LoanRole = 'owner' | 'borrower';

export type LoanPhase =
  | 'requested'
  | 'pickup'
  | 'reading'
  | 'dueSoon'
  | 'overdue'
  | 'returnPending'
  | 'returned'
  | 'notCollected'
  | 'declined'
  | 'expired'
  | 'cancelled'
  | 'ownerLeft';

export type LoanAction =
  /** Owner: accept a request (due-date sheet). */
  | 'accept'
  | 'decline'
  /** Borrower: withdraw a request. */
  | 'cancelRequest'
  /** WhatsApp the other person (the label depends on the phase). */
  | 'message'
  /** Borrower: "I've returned it" (confirm sheet). */
  | 'markReturned'
  /** Borrower: WhatsApp "could I keep it longer?". */
  | 'askMoreTime'
  /** Borrower, pick-up window: WhatsApp "not picking it up". */
  | 'notPickingUp'
  /** Owner: confirm the book is back (confirm sheet on the Loan screen). */
  | 'gotItBack'
  /** Owner, says returned: "Not back yet" (confirm sheet). */
  | 'notBackYet'
  /** Owner: WhatsApp reminder. */
  | 'nudge'
  /** Owner: change the due date. */
  | 'changeDue'
  /** Owner: close a loan that was never picked up. */
  | 'notCollected'
  /** Borrower, declined: add the book to the wishlist. */
  | 'addToWishlist'
  /** Borrower, expired: open the copy to ask again. */
  | 'askAgain'
  /** Borrower, lent to someone else: turn off the server's back-watch. */
  | 'stopNotify'
  /** Borrower, lent to someone else, after turning it off: watch for the copy again. */
  | 'notifyMe';

/** Actions that open WhatsApp (the other-party row hides its own button when P is one: R27). */
export const WHATSAPP_ACTIONS: readonly LoanAction[] = [
  'message',
  'askMoreTime',
  'notPickingUp',
  'nudge',
];

export type BannerTone = 'action' | 'info' | 'success' | 'warning' | 'danger' | 'muted';

export interface LoanView {
  role: LoanRole;
  phase: LoanPhase;
  /** Whether the loan is finished (no more actions on it). */
  closed: boolean;
  banner: { title: string; detail: string | null; tone: BannerTone };
  primary: LoanAction | null;
  secondary: LoanAction[];
  tertiary: LoanAction[];
  /** Borrower after a normal return: show "How was it?" (not for not collected / owner left). */
  showReview: boolean;
}

export interface LoanViewInput {
  loan: Loan;
  uid: string;
  /** The other person's display name (saved name, else profile/loan name). */
  other: string;
  /** Is there a phone number for the other person (WhatsApp)? */
  otherHasPhone: boolean;
  /** The owner's pickup note (borrower view, pick-up window). */
  pickupNote?: string | null;
  /** The copy's due date for "Lent to someone else · back around …" (borrower, declined). */
  backAround?: Date | null;
  /** Borrower, lent to someone else: am I watching for the copy to come back? (undefined: unknown) */
  watchingBack?: boolean;
  /** Borrower, lent to someone else: the copy is back and available to ask for again. */
  copyAvailable?: boolean;
  /** Owner: the borrower deleted their account (`borrowerUid` was cleared). */
  borrowerLeft?: boolean;
  now?: Date;
}

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const first = shortName;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** The loan's phase as seen at `now` (the same for both sides). */
export function loanPhase(loan: Loan, now: Date = new Date()): LoanPhase {
  switch (loan.status) {
    case 'requested': {
      // Past its 7 days, before the daily job marks it: it can't be accepted any more (QA B3/B14).
      const ends = requestExpiresAt(loan);
      return ends && ends.getTime() <= now.getTime() ? 'expired' : 'requested';
    }
    case 'returnPending':
      return 'returnPending';
    case 'returned':
      return 'returned';
    case 'declined':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'ownerLeft':
      return 'ownerLeft';
    case 'cancelled':
      return isNotCollected(loan) ? 'notCollected' : 'cancelled';
    case 'active': {
      if (inPickupWindow(loan, now)) return 'pickup';
      if (!loan.dueDate) return 'reading';
      const s = dueState(loan.dueDate, now);
      if (s.kind === 'overdue') return 'overdue';
      if (s.kind === 'today' || s.kind === 'soon') return 'dueSoon';
      return 'reading';
    }
  }
}

/** Banner and actions for the Loan screen. */
export function loanView({
  loan,
  uid,
  other,
  otherHasPhone,
  pickupNote,
  backAround,
  watchingBack,
  copyAvailable,
  borrowerLeft,
  now = new Date(),
}: LoanViewInput): LoanView {
  const role: LoanRole = loan.ownerId === uid ? 'owner' : 'borrower';
  const phase = loanPhase(loan, now);
  const name = first(other);
  const due = loan.dueDate ? dueLabel(loan.dueDate, now) : null;
  const wa = <T extends LoanAction>(a: T): T | null => (otherHasPhone ? a : null);
  const list = (...a: (LoanAction | null | false)[]) => a.filter((x): x is LoanAction => !!x);

  const base = { role, phase, showReview: false, closed: false };
  const closed = (title: string, detail: string | null, tone: BannerTone = 'muted'): LoanView => ({
    ...base,
    closed: true,
    banner: { title, detail, tone },
    primary: null,
    secondary: [],
    tertiary: [],
  });

  if (role === 'owner') {
    const v = ((): LoanView => {
      switch (phase) {
        case 'requested':
          return {
            ...base,
            banner: {
              title: `${name} wants to borrow it`,
              detail: cap(expiryLabel(loan, now) ?? '') || null,
              tone: 'action',
            },
            primary: 'accept',
            secondary: ['decline'],
            // Message lives on the other-party row (one WhatsApp button per screen, R27).
            tertiary: [],
          };
        case 'pickup':
          return {
            ...base,
            banner: {
              title: `Waiting for ${name} to pick up`,
              detail: due ? `You said yes · ${due}` : 'You said yes',
              tone: 'info',
            },
            // R27: the owner's P in the window is "Message Asha"; no Nudge.
            primary: wa('message'),
            secondary: [],
            tertiary: ['notCollected'],
          };
        case 'overdue': {
          const days = loan.dueDate ? (dueState(loan.dueDate, now) as { days: number }).days : 0;
          return {
            ...base,
            banner: {
              title: `${days} day${days === 1 ? '' : 's'} overdue`,
              detail: `With ${name} · was due ${formatShortDate(loan.dueDate!, now)}`,
              tone: 'danger',
            },
            // Without a number Got it back becomes the P (E6).
            primary: otherHasPhone ? 'nudge' : 'gotItBack',
            secondary: list(otherHasPhone && 'gotItBack'),
            // "Not collected?" only in the pick-up window (E4, QA B10); "Change" is on the due row.
            tertiary: [],
          };
        }
        case 'reading':
        case 'dueSoon':
          return {
            ...base,
            banner: { title: `With ${name}`, detail: due ? cap(due) : null, tone: 'info' },
            primary: null,
            secondary: list('gotItBack', wa('nudge')),
            // "Not collected?" only in the pick-up window (E4, QA B10); "Change" is on the due row.
            tertiary: [],
          };
        case 'returnPending':
          return {
            ...base,
            banner: {
              title: `${name} says it’s back`,
              detail: 'Confirm when you have it.',
              tone: 'action',
            },
            primary: 'gotItBack',
            secondary: ['notBackYet'],
            tertiary: [],
          };
        case 'returned':
          return closed(
            'Back on your shelf',
            loan.returnedAt ? `Returned ${formatShortDate(loan.returnedAt, now)}` : null,
            'success'
          );
        case 'notCollected':
          return closed('Not collected', `${name} didn’t pick it up. It’s available again.`);
        case 'declined':
          return closed(
            loan.declineReason === 'lentToSomeoneElse' ? 'Lent to someone else' : 'You declined',
            `${name} was told.`
          );
        case 'expired':
          // E5: "This request expired. Message Zoya?"
          return {
            ...closed('Request expired', `You didn’t answer ${name}’s request in 7 days.`),
            primary: wa('message'),
          };
        case 'cancelled':
          return loan.closedReason === 'copyRemoved'
            ? closed('Request cancelled', 'You removed this copy.')
            : closed('Request cancelled', `${name} cancelled the request.`);
        case 'ownerLeft':
          return closed('Closed', null);
      }
    })();
    // QA B13: the borrower deleted their account. The loan stays, with a clear banner.
    if (borrowerLeft && !v.closed) {
      v.banner = {
        title: `${name} left LendShelf`,
        detail: `You can still mark it back${otherHasPhone ? ' or message them on WhatsApp' : ''}.`,
        tone: 'warning',
      };
    }
    return v;
  }

  // ----- borrower -----
  switch (phase) {
    case 'requested':
      return {
        ...base,
        banner: {
          title: 'Request sent',
          detail: [`${name} can answer in LendShelf`, expiryLabel(loan, now)]
            .filter(Boolean)
            .join(' · '),
          tone: 'info',
        },
        primary: wa('message'),
        secondary: ['cancelRequest'],
        tertiary: [],
      };
    case 'pickup':
      return {
        ...base,
        banner: {
          title: `Pick up from ${name}`,
          detail: [`${name} said yes`, pickupNote?.trim() ? `pickup: ${pickupNote.trim()}` : null]
            .filter(Boolean)
            .join(' · '),
          tone: 'action',
        },
        primary: wa('message'),
        secondary: [],
        tertiary: list(wa('notPickingUp')),
      };
    case 'reading':
    case 'dueSoon':
    case 'overdue': {
      const days =
        phase === 'overdue' && loan.dueDate
          ? (dueState(loan.dueDate, now) as { days: number }).days
          : 0;
      if (loan.notBackYetAt) {
        // QA B1 / E4 "Not back yet": the owner said it isn't back. Talk first (P Message Ravi);
        // "I've returned it" stays available for when it really is back.
        return {
          ...base,
          banner: {
            title: `${name} hasn’t got it back yet`,
            detail:
              phase === 'overdue'
                ? `${days} day${days === 1 ? '' : 's'} overdue · was due ${formatShortDate(loan.dueDate!, now)}`
                : due
                  ? `From ${name} · ${due}`
                  : `From ${name}`,
            tone: phase === 'overdue' ? 'danger' : 'warning',
          },
          primary: otherHasPhone ? 'message' : 'markReturned',
          secondary: list(otherHasPhone && 'markReturned', wa('askMoreTime')),
          tertiary: [],
        };
      }
      return {
        ...base,
        banner:
          phase === 'overdue'
            ? {
                title: `${days} day${days === 1 ? '' : 's'} overdue`,
                detail: `From ${name} · was due ${formatShortDate(loan.dueDate!, now)}`,
                tone: 'danger',
              }
            : {
                title: 'With you',
                detail: due ? `From ${name} · ${due}` : `From ${name}`,
                tone: phase === 'dueSoon' ? 'warning' : 'info',
              },
        primary: 'markReturned',
        secondary: list(wa('askMoreTime')),
        tertiary: [],
      };
    }
    case 'returnPending':
      return {
        ...base,
        banner: {
          title: `Waiting for ${name} to confirm`,
          detail: 'You said you returned it.',
          tone: 'info',
        },
        primary: wa('message'),
        secondary: [],
        tertiary: [],
      };
    case 'returned':
      return {
        ...closed(
          `Returned to ${name}`,
          loan.returnedAt ? `Confirmed ${formatShortDate(loan.returnedAt, now)}` : null,
          'success'
        ),
        showReview: true,
      };
    case 'notCollected':
      return closed('Not collected', `${name} closed this loan because it wasn’t picked up.`);
    case 'declined': {
      const line = declinedLine(loan.declineReason, name, { backAround, now });
      if (loan.declineReason === 'lentToSomeoneElse' && copyAvailable) {
        // The copy came back since (QA B12): say so and offer to ask again.
        return {
          ...closed(`It’s back on ${name}’s shelf`, `${line}. You can ask again.`, 'success'),
          primary: 'askAgain',
        };
      }
      if (loan.declineReason === 'lentToSomeoneElse') {
        // "Lent to someone else · back around 12 Dec" (never who has it) + the back-watch (E5).
        return {
          ...closed(
            line,
            watchingBack === false ? 'Notify me is off.' : 'We’ll tell you when it’s back.'
          ),
          secondary: watchingBack === undefined ? [] : [watchingBack ? 'stopNotify' : 'notifyMe'],
        };
      }
      return { ...closed('Request declined', `${line}.`), primary: 'addToWishlist' };
    }
    case 'expired':
      return {
        ...closed('Your request expired', `${name} didn’t answer in 7 days.`),
        primary: 'askAgain',
      };
    case 'cancelled':
      return loan.closedReason === 'copyRemoved'
        ? closed('Request cancelled', `${name} removed this book from LendShelf.`)
        : closed('Request cancelled', 'You cancelled this request.');
    case 'ownerLeft':
      return closed(
        `${name} left LendShelf`,
        `If you still have ${loan.title}, message them on WhatsApp if you still have their number.`,
        'warning'
      );
  }
}

/** Button label for an action ("Message Ravi", "Got it back", …). */
export function actionLabel(
  action: LoanAction,
  view: Pick<LoanView, 'role' | 'phase'>,
  other: string
): string {
  const name = first(other);
  switch (action) {
    case 'accept':
      return 'Accept';
    case 'decline':
      return 'Decline';
    case 'cancelRequest':
      return 'Cancel request';
    case 'message':
      return view.role === 'borrower' && view.phase === 'requested'
        ? `Message ${name} again`
        : `Message ${name}`;
    case 'markReturned':
      return 'I’ve returned it';
    case 'askMoreTime':
      return 'Ask for more time';
    case 'notPickingUp':
      return `Not picking it up? Tell ${name}`;
    case 'gotItBack':
      return 'Got it back';
    case 'notBackYet':
      return 'Not back yet';
    case 'nudge':
      return view.phase === 'overdue' ? 'Nudge on WhatsApp' : `Nudge ${name}`;
    case 'changeDue':
      return 'Change due date';
    case 'notCollected':
      return 'Not collected? Close this loan';
    case 'addToWishlist':
      return 'Add to wishlist';
    case 'askAgain':
      return 'Ask again';
    case 'stopNotify':
      return 'Turn off “Notify me”';
    case 'notifyMe':
      return 'Notify me when it’s back';
  }
}

export interface TimelineEntry {
  key: string;
  label: string;
  at: Date;
}

/**
 * Timeline from the loan's timestamps (D4): Asked · Accepted (due …) · Returned · Confirmed,
 * plus how a closed loan ended. Oldest first.
 */
export function loanTimeline(loan: Loan, uid: string, other: string): TimelineEntry[] {
  const owner = loan.ownerId === uid;
  const name = first(other);
  const out: TimelineEntry[] = [];
  const at = (t: { toDate(): Date } | null | undefined) => (t ? t.toDate() : null);

  const asked = at(loan.requestedAt);
  if (asked) out.push({ key: 'asked', label: owner ? `${name} asked` : 'You asked', at: asked });

  const started = at(loan.startedAt);
  const dueMoved = at(loan.dueChangedAt);
  if (started) {
    // The accepted row keeps the first due date; a change adds "Due date moved to …" (QA B9, D4).
    const firstDue = dueMoved ? (loan.firstDueDate ?? null) : loan.dueDate;
    const dueText = firstDue ? ` (due ${formatShortDate(firstDue)})` : '';
    out.push({
      key: 'started',
      label:
        (loan.requestedAt ? 'Accepted' : owner ? `Lent to ${name}` : `${name} lent it to you`) +
        dueText,
      at: started,
    });
  }
  if (dueMoved && loan.dueDate) {
    out.push({
      key: 'dueMoved',
      label: `Due date moved to ${formatShortDate(loan.dueDate)}`,
      at: dueMoved,
    });
  }

  const marked = at(loan.returnMarkedAt);
  if (marked) {
    out.push({
      key: 'marked',
      label: owner ? `${name} said it’s back` : 'You said you returned it',
      at: marked,
    });
  }

  const notBack = at(loan.notBackYetAt);
  if (notBack) {
    out.push({
      key: 'notBackYet',
      label: owner ? 'You said it’s not back yet' : `${name} hasn’t got it back yet`,
      at: notBack,
    });
  }

  const end = at(loan.returnedAt) ?? at(loan.updatedAt);
  if (end) {
    switch (loan.status) {
      case 'returned':
        out.push({ key: 'end', label: marked ? 'Confirmed back' : 'Returned', at: end });
        break;
      case 'declined':
        out.push({
          key: 'end',
          label: loan.declineReason === 'lentToSomeoneElse' ? 'Lent to someone else' : 'Declined',
          at: end,
        });
        break;
      case 'expired':
        out.push({ key: 'end', label: 'Expired', at: end });
        break;
      case 'cancelled':
        out.push({
          key: 'end',
          label: isNotCollected(loan) ? 'Closed: not collected' : 'Cancelled',
          at: end,
        });
        break;
      case 'ownerLeft':
        out.push({ key: 'end', label: `${owner ? 'You' : name} left LendShelf`, at: end });
        break;
      default:
        break;
    }
  }
  // Oldest first; equal times keep the order above (stable sort).
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
