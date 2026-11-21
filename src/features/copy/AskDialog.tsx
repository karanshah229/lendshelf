/**
 * "Ask to borrow": creates the request (requestLoan) and then opens WhatsApp with a
 * prefilled message to the owner. Used on the Copy page and the Book page's quick "Ask".
 *
 * R14: warns when I already asked someone else for this Book, or already have it.
 * Retry after a lost response (E4): `already-exists` opens my existing request's Loan screen
 * and still opens WhatsApp, so the ask is never lost.
 */
import { router } from 'expo-router';
import { CircleAlert, MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
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
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { askConflict, askConflictText, existingRequestFor } from '@/features/loans/requests';
import { askForPushInContext } from '@/features/push-ask/ask';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import { useProfile, useUid } from '@/hooks/use-auth';
import { useItem } from '@/hooks/use-items';
import { useMyLoans } from '@/hooks/use-loans';
import { api } from '@/lib/api';
import { announce } from '@/lib/a11y';
import { errorCode } from '@/lib/errors';
import { toast, toastError } from '@/lib/toast';
import { askMessage } from '@/lib/whatsapp';

import { openWhatsApp } from '@/features/shared/whatsapp-open';

const MESSAGE_LIMIT = 500;

export interface AskTarget {
  itemId: string;
  title: string;
  coverUrl: string | null;
  /** Name to show (my saved name for them). */
  ownerName: string;
  /** The WhatsApp text greets them by their profile name, never the saved name (F6). */
  ownerId: string;
  /** The Book, for the R14 warning (read from the copy when not given). */
  workId?: string;
}

export function AskDialog({
  target,
  onOpenChange,
  onSent,
}: {
  /** The copy to ask for; `null` closes the dialog. */
  target: AskTarget | null;
  onOpenChange(open: boolean): void;
  onSent?(loanId: string): void;
}) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const { profile: ownerProfile } = useProfile(target?.ownerId);
  const uid = useUid();
  const { asBorrower } = useMyLoans();
  const { item } = useItem(target && !target.workId ? target.itemId : null);
  const conflict = target
    ? askConflict({ itemId: target.itemId, workId: target.workId ?? item?.workId }, uid, asBorrower)
    : null;
  const people = useLoanPeople(conflict ? [conflict.loan] : []);

  const close = () => {
    if (sending) return;
    onOpenChange(false);
    setNote('');
  };

  const send = async () => {
    if (!target) return;
    setSending(true);
    // F8: sending → sent is announced ("Request sent" comes with the toast).
    announce('Sending request…');
    try {
      const trimmed = note.trim();
      const res = await api.requestLoan({
        itemId: target.itemId,
        ...(trimmed ? { message: trimmed } : {}),
      });
      toast.success('Request sent', {
        description: `${target.ownerName} can accept it in LendShelf.`,
      });
      onSent?.(res.loanId);
      onOpenChange(false);
      setNote('');
      // C11: the first request is when notifications start to matter ("Get told when … answers?").
      void askForPushInContext('request', { name: target.ownerName, title: target.title });
      if (res.ownerPhone) {
        await openWhatsApp(
          res.ownerPhone,
          askMessage({ ownerName: ownerProfile?.name, title: target.title, note: trimmed })
        );
      }
    } catch (e) {
      const existing =
        errorCode(e) === 'already-exists'
          ? existingRequestFor(target.itemId, uid, asBorrower)
          : null;
      if (existing) {
        // The first try went through and only the response was lost: open that request.
        onSent?.(existing.id);
        onOpenChange(false);
        setNote('');
        router.push({ pathname: '/loan/[loanId]', params: { loanId: existing.id } });
        const phone = existing.ownerPhone;
        if (phone) {
          await openWhatsApp(
            phone,
            askMessage({ ownerName: ownerProfile?.name, title: target.title, note: note.trim() })
          );
        }
      } else {
        toastError(e, 'Couldn’t send the request.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => (open ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ask to borrow</DialogTitle>
          <DialogDescription>
            {target?.ownerName ?? 'The owner'} gets a request in LendShelf. We’ll then open WhatsApp
            so you can say hi.
          </DialogDescription>
        </DialogHeader>
        {target ? (
          <View className="flex-row items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <BookCover uri={target.coverUrl} title={target.title} size="xs" />
            <View className="flex-1">
              <Text className="font-semibold" numberOfLines={2}>
                {target.title}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                from {target.ownerName}
              </Text>
              {/* E4 step 1 (QA B19): the owner's pickup note, when they set one. */}
              {ownerProfile?.pickupNote?.trim() ? (
                <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                  Pickup: {ownerProfile.pickupNote.trim()}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}
        {conflict ? (
          <View
            className="flex-row gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3"
            accessibilityRole="alert"
          >
            <Icon
              as={CircleAlert}
              size={16}
              className="mt-0.5 text-amber-700 dark:text-amber-400"
            />
            <Text className="flex-1 text-sm leading-5">
              {askConflictText(conflict.kind, people.name(conflict.loan))}
            </Text>
          </View>
        ) : null}
        <View className="gap-1.5">
          <Textarea
            value={note}
            onChangeText={(t) => setNote(t.slice(0, MESSAGE_LIMIT))}
            placeholder="Add a note (optional), e.g. when you could pick it up"
            numberOfLines={3}
            maxLength={MESSAGE_LIMIT}
            editable={!sending}
            accessibilityLabel="Note to the owner"
          />
          {note.length > MESSAGE_LIMIT - 100 ? (
            <Text className="self-end text-xs text-muted-foreground">
              {note.length}/{MESSAGE_LIMIT}
            </Text>
          ) : null}
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={close} disabled={sending}>
            <Text>Cancel</Text>
          </Button>
          <Button onPress={send} disabled={sending}>
            {sending ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon as={MessageCircle} size={16} className="text-primary-foreground" />
            )}
            <Text>{sending ? 'Sending…' : 'Send request'}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
