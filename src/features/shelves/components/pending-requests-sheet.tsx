/**
 * Named confirm sheet for sharing changes that affect pending requests (UX §E9, §F3, C12):
 * hide, move to a private collection, make a collection private (confirm or cancel), and
 * Not lending (Decline, the default, or Keep).
 */
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import type { SheetCopy } from '@/features/shelves/pending-requests';

export function PendingRequestsSheet({
  copy,
  onClose,
  onConfirm,
  onKeep,
}: {
  /** The sheet's text; `null` closes it. */
  copy: SheetCopy | null;
  onClose(): void;
  /** Declines, then applies the change. Resolve to close; throw to keep the sheet open. */
  onConfirm(): Promise<void>;
  /** Not lending only: apply the change and keep the requests. */
  onKeep?(): Promise<void>;
}) {
  const [busy, setBusy] = useState<'confirm' | 'keep' | null>(null);

  const run = async (which: 'confirm' | 'keep', fn: () => Promise<void>) => {
    setBusy(which);
    try {
      await fn();
      onClose();
    } catch {
      // The caller showed the error; keep the sheet open to retry.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={!!copy} onOpenChange={(o) => !o && !busy && onClose()}>
      {copy ? (
        <DialogContent className="w-[22rem] max-w-full">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button size="lg" disabled={!!busy} onPress={() => void run('confirm', onConfirm)}>
              {busy === 'confirm' ? <ActivityIndicator size="small" /> : null}
              <Text>{busy === 'confirm' ? 'Declining…' : copy.confirm}</Text>
            </Button>
            {copy.keep && onKeep ? (
              <Button
                size="lg"
                variant="outline"
                disabled={!!busy}
                onPress={() => void run('keep', onKeep)}
              >
                {busy === 'keep' ? <ActivityIndicator size="small" /> : null}
                <Text>{copy.keep}</Text>
              </Button>
            ) : (
              <Button size="lg" variant="outline" disabled={!!busy} onPress={onClose}>
                <Text>Cancel</Text>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
