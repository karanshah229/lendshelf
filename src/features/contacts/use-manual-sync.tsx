/**
 * "Sync now" (Me, Contacts screen): one `syncContacts` call, then, if the server's shrink guard
 * kept people instead of removing them (B1), the "Sync anyway" sheet (UX §E13):
 * Keep everyone, or Remove them (resent with `replace: true`).
 *
 *   const manual = useManualSync();
 *   const outcome = await manual.sync();
 *   return <>{…}{manual.element}</>;
 */
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { syncErrorText } from '@/features/first-run/first-run';
import { errorCode } from '@/lib/errors';
import { syncContactsNow, type SyncOutcome } from '@/lib/sync-contacts';
import { toast, toastError } from '@/lib/toast';

import { afterSync, syncAnywayCopy } from './resync';

export type ManualSyncResult = SyncOutcome | { status: 'error'; message: string };

export function useManualSync() {
  const [skipped, setSkipped] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  /** Syncs; failures come back as `{ status: 'error', message }` for the caller to show. */
  const sync = async (): Promise<ManualSyncResult> => {
    try {
      const res = await syncContactsNow();
      if (res.status === 'synced' && afterSync('manual', res.skippedRemovals) === 'askSyncAnyway') {
        setSkipped(res.skippedRemovals);
      }
      return res;
    } catch (e) {
      return { status: 'error', message: syncErrorText(errorCode(e)) };
    }
  };

  const removeThem = async () => {
    setRemoving(true);
    try {
      const res = await syncContactsNow({ replace: true });
      if (res.status === 'synced') {
        const n = res.links.length;
        toast.success(`Contacts synced · ${n} ${n === 1 ? 'person' : 'people'} on LendShelf`);
      }
      setSkipped(null);
    } catch (e) {
      toastError(e, syncErrorText(errorCode(e)));
    } finally {
      setRemoving(false);
    }
  };

  const copy = syncAnywayCopy(skipped ?? 0);
  const element = (
    <AlertDialog
      open={skipped !== null}
      onOpenChange={(open) => {
        if (!open && !removing) setSkipped(null);
      }}
    >
      {skipped !== null ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              className="min-h-12"
              disabled={removing}
              onPress={() => void removeThem()}
              accessibilityLabel={`Remove ${skipped} ${skipped === 1 ? 'person' : 'people'} from your circle`}
            >
              {removing ? <ActivityIndicator size="small" /> : null}
              <Text>{removing ? 'Removing…' : 'Remove them'}</Text>
            </Button>
            <Button className="min-h-12" disabled={removing} onPress={() => setSkipped(null)}>
              <Text>Keep everyone</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );

  return { sync, element, syncAnywayOpen: skipped !== null };
}
