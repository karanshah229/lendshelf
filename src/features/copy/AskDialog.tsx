/**
 * "Ask to borrow": creates the request (requestLoan) and then opens WhatsApp with a
 * prefilled message to the owner. Used on the Copy page and the Book page's quick "Ask".
 */
import { MessageCircle } from 'lucide-react-native';
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
import { api } from '@/lib/api';
import { toast, toastError } from '@/lib/toast';
import { askMessage } from '@/lib/whatsapp';

import { openWhatsApp } from '@/features/shared/whatsapp-open';

const MESSAGE_LIMIT = 500;

export interface AskTarget {
  itemId: string;
  title: string;
  coverUrl: string | null;
  ownerName: string;
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

  const close = () => {
    if (sending) return;
    onOpenChange(false);
    setNote('');
  };

  const send = async () => {
    if (!target) return;
    setSending(true);
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
      if (res.ownerPhone) {
        await openWhatsApp(
          res.ownerPhone,
          askMessage({ ownerName: target.ownerName, title: target.title, note: trimmed })
        );
      }
    } catch (e) {
      toastError(e, 'Couldn’t send the request.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => (open ? onOpenChange(true) : close())}>
      <DialogContent className="w-[420px] max-w-full">
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
            </View>
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
