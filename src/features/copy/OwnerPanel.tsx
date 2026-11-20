/**
 * Copy page for my own copy: status and loan actions (Lend, Mark returned, Nudge),
 * sharing (visibility, collection), edition editing and delete.
 */
import { router } from 'expo-router';
import {
  BookCheck,
  Clock,
  Eye,
  EyeOff,
  HandHelping,
  Inbox,
  Lock,
  MessageCircle,
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
import { api } from '@/lib/api';
import { backLabel } from '@/lib/dates';
import { toast, toastError } from '@/lib/toast';
import { nudgeMessage } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';
import type { Item, Visibility, WithId } from '@/types/model';

import type { OwnerCopyState } from '@/features/copy/copy-actions';
import { deleteItem, moveItemToShelf, updateItemVisibility } from '@/features/shared/mutations';
import { capitalize } from '@/features/shared/people';
import { SectionHeader } from '@/features/shared/ui';
import { openWhatsApp } from '@/features/shared/whatsapp-open';

const VISIBILITY: { value: Visibility; label: string; icon: LucideIcon; help: string }[] = [
  {
    value: 'lendable',
    label: 'Lendable',
    icon: HandHelping,
    help: 'Contacts can see it and ask to borrow it.',
  },
  {
    value: 'visible',
    label: 'Visible',
    icon: Eye,
    help: 'Contacts can see it but can’t ask to borrow it.',
  },
  { value: 'hidden', label: 'Hidden', icon: EyeOff, help: 'Only you can see it.' },
];

export function OwnerPanel({ item, state }: { item: WithId<Item>; state: OwnerCopyState }) {
  const insets = useSafeAreaInsets();
  const { shelves } = useMyShelves();
  const { incomingRequests } = useMyLoans();
  const { loan } = useLoan(state.returnLoanId);
  const [busy, setBusy] = useState<'visibility' | 'shelf' | 'return' | null>(null);

  const shelf = shelves.find((s) => s.id === item.shelfId) ?? null;
  const requests = incomingRequests.filter((l) => l.itemId === item.id);
  const lent = item.loanState === 'lent';
  const visibilityHelp = VISIBILITY.find((v) => v.value === item.visibility)?.help;

  const changeVisibility = async (v: Visibility) => {
    if (!shelf || v === item.visibility) return;
    setBusy('visibility');
    try {
      await updateItemVisibility(item.id, v, shelf.isPublic);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const changeShelf = async (shelfId: string) => {
    const target = shelves.find((s) => s.id === shelfId);
    if (!target || target.id === item.shelfId) return;
    setBusy('shelf');
    try {
      await moveItemToShelf(item.id, target, item.visibility);
      toast.success(`Moved to ${target.name}`);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const confirmReturn = async () => {
    if (!state.returnLoanId) return;
    setBusy('return');
    try {
      await api.confirmReturn({ loanId: state.returnLoanId });
      toast.success('Marked as returned', { description: 'It’s back on your shelf.' });
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const nudge = () =>
    loan?.borrowerPhone &&
    openWhatsApp(
      loan.borrowerPhone,
      nudgeMessage({ borrowerName: loan.borrowerName, title: item.title, dueDate: loan.dueDate })
    );

  const statusIcon = lent ? Clock : BookCheck;
  const statusTitle = lent
    ? loan
      ? `Lent to ${loan.borrowerName}`
      : 'Lent out'
    : item.visibility === 'hidden' || !item.sharedWithContacts
      ? 'On your shelf (private)'
      : item.visibility === 'visible'
        ? 'On your shelf (not lending)'
        : 'On your shelf';
  const statusDetail = lent
    ? capitalize(backLabel(item.dueDate))
    : item.sharedWithContacts && item.visibility === 'lendable'
      ? 'Contacts can ask to borrow it'
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
          <Button variant="secondary" onPress={() => router.push('/loans')}>
            <Icon as={Inbox} size={16} />
            <Text>
              {requests.length === 1
                ? `${requests[0]!.borrowerName} wants to borrow it`
                : `${requests.length} people want to borrow it`}
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="lg" disabled={busy === 'return'}>
                  <Icon as={BookCheck} size={16} className="text-primary-foreground" />
                  <Text>{busy === 'return' ? 'Saving…' : 'Mark returned'}</Text>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Got it back?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {loan
                      ? `This closes the loan to ${loan.borrowerName} and puts “${item.title}” back on your shelf.`
                      : `This closes the loan and puts “${item.title}” back on your shelf.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    <Text>Not yet</Text>
                  </AlertDialogCancel>
                  <AlertDialogAction onPress={confirmReturn}>
                    <Text>Mark returned</Text>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          {lent && loan?.borrowerPhone ? (
            <Button variant="outline" onPress={nudge}>
              <Icon as={MessageCircle} size={16} />
              <Text>Nudge on WhatsApp</Text>
            </Button>
          ) : null}
        </View>
      </Card>

      <View>
        <SectionHeader title="Sharing" />
        <Card className="gap-4 px-4 py-4">
          <View className="gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              value={item.visibility}
              onValueChange={(v) => v && void changeVisibility(v as Visibility)}
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
              onValueChange={(opt) => opt && void changeShelf(opt.value)}
              disabled={!shelves.length || busy === 'shelf'}
            >
              <SelectTrigger className="w-full">
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
                  {shelf.name} is private, so contacts can’t see this copy.
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      </View>
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
            <AlertDialogAction onPress={remove} className="bg-destructive">
              <Text className="text-white">Delete</Text>
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
