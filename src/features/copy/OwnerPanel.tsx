/**
 * Copy page for my own copy: status and loan actions (Lend, Open loan, Got it back),
 * sharing (visibility, collection), edition editing and delete.
 */
import { router } from 'expo-router';
import {
  ArrowRight,
  BookCheck,
  Clock,
  Eye,
  EyeOff,
  HandHelping,
  Inbox,
  Lock,
  PackageCheck,
  Send,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupIcon, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useLoan, useMyLoans } from '@/hooks/use-loans';
import { useMyShelves } from '@/hooks/use-shelves';
import { backLabel } from '@/lib/dates';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  isSharedWithContacts,
  type Item,
  type Shelf,
  type Visibility,
  type WithId,
} from '@/types/model';

import type { OwnerCopyState } from '@/features/copy/copy-actions';
import { VISIBILITY_COPY } from '@/features/copy/visibility-copy';
import { useLoanSheets } from '@/features/loans/loan-sheets';
import { inPickupWindow } from '@/features/loans/needs-you';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import { deleteItem, moveItemToShelf, updateItemVisibility } from '@/features/shared/mutations';
import { capitalize } from '@/features/shared/people';
import { SectionHeader } from '@/features/shared/ui';
import { declinePendingRequests } from '@/features/shelves/actions';
import { PendingRequestsSheet } from '@/features/shelves/components/pending-requests-sheet';
import {
  hideSheet,
  moveToPrivateSheet,
  notLendingSheet,
  pendingRequestsEffect,
  requestsOnItems,
  type SheetCopy,
} from '@/features/shelves/pending-requests';

/** What a visibility change says when it applies (E9: "apply instantly with a toast"). */
const VISIBILITY_TOAST: Record<Visibility, string> = {
  lendable: 'Lendable · people can ask to borrow it',
  visible: 'Not lending · people can see it but can’t ask',
  hidden: 'Hidden · only you can see it',
};

type PendingChange =
  | { kind: 'visibility'; to: Visibility; copy: SheetCopy }
  | { kind: 'shelf'; to: WithId<Shelf>; copy: SheetCopy };

const VISIBILITY: { value: Visibility; label: string; icon: LucideIcon; help: string }[] = [
  { value: 'lendable', icon: HandHelping, ...VISIBILITY_COPY.lendable },
  { value: 'visible', icon: Eye, ...VISIBILITY_COPY.visible },
  { value: 'hidden', icon: EyeOff, ...VISIBILITY_COPY.hidden },
];

export function OwnerPanel({ item, state }: { item: WithId<Item>; state: OwnerCopyState }) {
  const insets = useSafeAreaInsets();
  const { shelves } = useMyShelves();
  const { incomingRequests } = useMyLoans();
  const { loan } = useLoan(state.returnLoanId);
  const requests = requestsOnItems(incomingRequests, [item.id]);
  const people = useLoanPeople(loan ? [loan, ...requests] : requests);
  const sheets = useLoanSheets();
  const [busy, setBusy] = useState<'visibility' | 'shelf' | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const requesterNames = requests.map((l) => people.name(l));

  const shelf = shelves.find((s) => s.id === item.shelfId) ?? null;
  const lent = item.loanState === 'lent';
  const visibilityHelp = VISIBILITY.find((v) => v.value === item.visibility)?.help;

  /** Declines the copy's pending requests (`notLending`), then applies the change (E9). */
  const declineThen = async (apply: () => Promise<void>) => {
    try {
      await declinePendingRequests(requests.map((l) => l.id));
    } catch (e) {
      // Nothing changed: the copy stays as it was, so nobody sees "Copy not found".
      toastError(e);
      throw e;
    }
    await apply();
  };

  /** Throws (after a toast) so a confirm sheet stays open to retry. */
  const applyVisibility = async (v: Visibility) => {
    if (!shelf) return;
    setBusy('visibility');
    try {
      await updateItemVisibility(item.id, v, shelf.isPublic);
      toast.success(VISIBILITY_TOAST[v]);
    } catch (e) {
      toastError(e);
      throw e;
    } finally {
      setBusy(null);
    }
  };

  const applyShelf = async (target: WithId<Shelf>) => {
    setBusy('shelf');
    try {
      await moveItemToShelf(item.id, target, item.visibility);
      toast.success(`Moved to ${target.name}`);
    } catch (e) {
      toastError(e);
      throw e;
    } finally {
      setBusy(null);
    }
  };

  const changeVisibility = (v: Visibility) => {
    if (!shelf || v === item.visibility) return;
    const effect = pendingRequestsEffect(
      { visibility: item.visibility, shared: item.sharedWithContacts },
      { visibility: v, shared: isSharedWithContacts(shelf.isPublic, v) },
      requests.length
    );
    if (effect === 'decline') {
      setPending({ kind: 'visibility', to: v, copy: hideSheet(item.title, requesterNames) });
    } else if (effect === 'ask') {
      setPending({ kind: 'visibility', to: v, copy: notLendingSheet(requesterNames) });
    } else {
      void applyVisibility(v).catch(() => undefined);
    }
  };

  const changeShelf = (shelfId: string) => {
    const target = shelves.find((s) => s.id === shelfId);
    if (!target || target.id === item.shelfId) return;
    const effect = pendingRequestsEffect(
      { visibility: item.visibility, shared: item.sharedWithContacts },
      {
        visibility: item.visibility,
        shared: isSharedWithContacts(target.isPublic, item.visibility),
      },
      requests.length
    );
    if (effect === 'decline') {
      setPending({
        kind: 'shelf',
        to: target,
        copy: moveToPrivateSheet(item.title, target.name, requesterNames),
      });
    } else {
      void applyShelf(target).catch(() => undefined);
    }
  };

  const applyPending = (p: PendingChange) =>
    p.kind === 'visibility' ? applyVisibility(p.to) : applyShelf(p.to);

  const openLoan = (loanId: string) =>
    router.push({ pathname: '/loan/[loanId]', params: { loanId } });

  // F6: the owner's own view says "Out · back 12 Dec"; the pick-up window and "says returned"
  // are said in words (D4 Copy page, owner).
  const borrower = loan ? people.name(loan) : null;
  const statusIcon = lent ? Clock : BookCheck;
  const statusTitle = lent
    ? capitalize(`out · ${backLabel(item.dueDate)}`.replace('out · lent out', 'out'))
    : item.visibility === 'hidden' || !item.sharedWithContacts
      ? 'On your shelf (private)'
      : item.visibility === 'visible'
        ? 'On your shelf (not lending)'
        : 'On your shelf';
  const statusDetail = lent
    ? loan && borrower
      ? loan.status === 'returnPending'
        ? `${borrower} says it’s back`
        : inPickupWindow(loan)
          ? `Waiting for ${borrower} to pick up`
          : `With ${borrower}`
      : null
    : item.sharedWithContacts && item.visibility === 'lendable'
      ? 'People who have your number saved can ask to borrow it'
      : null;

  return (
    <View className="gap-6">
      <Card className="gap-4 px-4 py-4">
        <View className="flex-row items-center gap-3">
          <View
            className={cn(
              'size-10 items-center justify-center rounded-full',
              lent ? 'bg-sky-500/15' : 'bg-emerald-500/15'
            )}
          >
            <Icon
              as={statusIcon}
              size={20}
              className={
                lent ? 'text-sky-600 dark:text-sky-400' : 'text-emerald-600 dark:text-emerald-400'
              }
            />
          </View>
          <View className="flex-1">
            <Text className="font-semibold">{statusTitle}</Text>
            {statusDetail ? (
              <Text className="text-sm text-muted-foreground">{statusDetail}</Text>
            ) : null}
          </View>
        </View>

        {requests.length ? (
          <Button
            variant="secondary"
            className="min-h-11"
            onPress={() =>
              requests.length === 1 ? openLoan(requests[0]!.id) : router.push('/loans')
            }
          >
            <Icon as={Inbox} size={16} />
            <Text>
              {requests.length === 1
                ? `${people.name(requests[0]!)} wants to borrow it`
                : `${requests.length} people want it · Review requests`}
            </Text>
          </Button>
        ) : null}

        <View className="gap-2">
          {state.canLend ? (
            <Button
              size="lg"
              onPress={() =>
                router.push({ pathname: '/lend/[itemId]', params: { itemId: item.id } })
              }
            >
              <Icon as={Send} size={16} className="text-primary-foreground" />
              <Text>Lend this copy</Text>
            </Button>
          ) : null}
          {state.returnLoanId ? (
            <>
              <Button size="lg" onPress={() => openLoan(state.returnLoanId!)}>
                <Icon as={ArrowRight} size={16} className="text-primary-foreground" />
                <Text>Open loan</Text>
              </Button>
              {loan ? (
                <Button
                  variant="outline"
                  size="lg"
                  disabled={sheets.busyId === loan.id}
                  onPress={() => sheets.confirm('gotItBack', loan)}
                >
                  <Icon as={PackageCheck} size={16} />
                  <Text>Got it back</Text>
                </Button>
              ) : null}
            </>
          ) : null}
        </View>
      </Card>
      {sheets.element}

      <View>
        <SectionHeader title="Sharing" />
        <Card className="gap-4 px-4 py-4">
          <View className="gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              value={item.visibility}
              onValueChange={(v) => v && changeVisibility(v as Visibility)}
              disabled={!shelf || busy === 'visibility'}
              className="w-full"
            >
              {VISIBILITY.map((o, i) => (
                <ToggleGroupItem
                  key={o.value}
                  value={o.value}
                  aria-label={o.label}
                  isFirst={i === 0}
                  isLast={i === VISIBILITY.length - 1}
                  className="flex-1 flex-row gap-1.5"
                >
                  <ToggleGroupIcon as={o.icon} size={14} />
                  <Text>{o.label}</Text>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {visibilityHelp ? (
              <Text className="text-xs text-muted-foreground">{visibilityHelp}</Text>
            ) : null}
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium">Collection</Text>
            <Select
              value={shelf ? { value: shelf.id, label: shelf.name } : undefined}
              onValueChange={(opt) => opt && changeShelf(opt.value)}
              disabled={!shelves.length || busy === 'shelf'}
            >
              <SelectTrigger
                className="w-full"
                aria-label={
                  shelf
                    ? `Collection, ${shelf.name}${shelf.isPublic ? '' : ', private'}`
                    : 'Choose a collection'
                }
              >
                <SelectValue placeholder="Choose a collection" />
              </SelectTrigger>
              <SelectContent
                insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}
                className="w-72"
              >
                <SelectGroup>
                  {shelves.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={s.id}
                      label={s.isPublic ? s.name : `${s.name} (private)`}
                    >
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {shelf && !shelf.isPublic ? (
              <View className="flex-row items-center gap-1.5">
                <Icon as={Lock} size={12} className="text-muted-foreground" />
                <Text className="flex-1 text-xs text-muted-foreground">
                  {shelf.name} is private, so only you can see this copy.
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      </View>

      <PendingRequestsSheet
        copy={pending?.copy ?? null}
        onClose={() => setPending(null)}
        onConfirm={() => declineThen(() => applyPending(pending!))}
        onKeep={() => applyPending(pending!)}
      />
    </View>
  );
}

/** Delete button with confirmation; disabled while the copy is lent. */
export function DeleteCopySection({ item, state }: { item: WithId<Item>; state: OwnerCopyState }) {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await deleteItem(item.id);
      toast.success('Copy deleted');
      if (router.canGoBack()) router.back();
      else router.replace('/my-books');
    } catch (e) {
      toastError(e);
      setBusy(false);
    }
  };

  return (
    <View className="gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" disabled={!state.canDelete || busy} className="self-center">
            <Icon as={Trash2} size={16} className="text-destructive" />
            <Text className="text-destructive">{busy ? 'Deleting…' : 'Delete this copy'}</Text>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this copy?</AlertDialogTitle>
            <AlertDialogDescription>
              “{item.title}” will be removed from your shelves. Its loan history and reviews of the
              book stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Cancel</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={remove} variant="destructive">
              <Text>Delete</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.deleteBlockedReason ? (
        <Text className="text-center text-xs text-muted-foreground">
          {state.deleteBlockedReason}
        </Text>
      ) : null}
    </View>
  );
}
