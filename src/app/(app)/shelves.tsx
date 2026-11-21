import { ChevronDown, ChevronUp, Globe, Lock, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import {
  createShelf,
  declinePendingRequests,
  deleteShelf,
  renameShelf,
  saveSortOrders,
  setShelfPublic,
} from '@/features/shelves/actions';
import { PendingRequestsSheet } from '@/features/shelves/components/pending-requests-sheet';
import { DeleteShelfDialog, ShelfFormDialog } from '@/features/shelves/components/shelf-dialogs';
import { defaultMoveTarget, moveShelf, nextSortOrder } from '@/features/shelves/logic';
import {
  makePrivateSheet,
  requestersToDecline,
  requestsOnItems,
  type SheetCopy,
} from '@/features/shelves/pending-requests';
import { useUid } from '@/hooks/use-auth';
import { useMyItems } from '@/hooks/use-items';
import { useMyLoans } from '@/hooks/use-loans';
import { useMyShelves } from '@/hooks/use-shelves';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { defaultShelfId, type Shelf, type WithId } from '@/types/model';

type DialogState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'rename'; shelf: WithId<Shelf> }
  | { kind: 'delete'; shelf: WithId<Shelf> };

const books = (n: number) => `${n} ${n === 1 ? 'book' : 'books'}`;

/** Collections: create, rename, reorder, public/private, delete (moving the books). */
export default function ShelvesScreen() {
  const uid = useUid();
  const { shelves, loading } = useMyShelves();
  const { items } = useMyItems();
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [dialogKey, setDialogKey] = useState(0);
  const [busy, setBusy] = useState<Record<string, 'visibility' | 'order' | undefined>>({});
  const { incomingRequests } = useMyLoans();
  const people = useLoanPeople(incomingRequests);
  /** Making a collection private while some of its books have pending requests (E9). */
  const [makingPrivate, setMakingPrivate] = useState<{
    shelf: WithId<Shelf>;
    loanIds: string[];
    copy: SheetCopy;
  } | null>(null);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) m[i.shelfId] = (m[i.shelfId] ?? 0) + 1;
    return m;
  }, [items]);

  const open = (d: DialogState) => {
    setDialogKey((k) => k + 1);
    setDialog(d);
  };
  const closeDialog = (o: boolean) => {
    if (!o) setDialog({ kind: 'none' });
  };

  /** Throws (after a toast) so the confirm sheet can stay open to retry. */
  const applyPublic = async (shelf: WithId<Shelf>, isPublic: boolean) => {
    setBusy((b) => ({ ...b, [shelf.id]: 'visibility' }));
    try {
      await setShelfPublic(shelf.id, isPublic);
      toast.success(
        isPublic
          ? `${shelf.name} is shared with people who have your number saved`
          : `${shelf.name} is now private`
      );
    } catch (e) {
      toastError(e);
      throw e;
    } finally {
      setBusy((b) => ({ ...b, [shelf.id]: undefined }));
    }
  };

  const togglePublic = (shelf: WithId<Shelf>, isPublic: boolean) => {
    if (!isPublic) {
      // Copies that people can see now (not hidden) and that someone asked for.
      const shared = items.filter((i) => i.shelfId === shelf.id && i.visibility !== 'hidden');
      const requests = requestsOnItems(
        incomingRequests,
        shared.map((i) => i.id)
      );
      if (requests.length) {
        const declines = requestersToDecline(requests, people.name);
        setMakingPrivate({
          shelf,
          loanIds: declines.map((d) => d.loanId),
          copy: makePrivateSheet(shelf.name, shared.length, declines),
        });
        return;
      }
    }
    void applyPublic(shelf, isPublic).catch(() => undefined);
  };

  const move = async (shelf: WithId<Shelf>, direction: 'up' | 'down') => {
    const updates = moveShelf(shelves, shelf.id, direction);
    if (!updates.length) return;
    setBusy((b) => ({ ...b, [shelf.id]: 'order' }));
    try {
      await saveSortOrders(updates);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy((b) => ({ ...b, [shelf.id]: undefined }));
    }
  };

  const newButton = (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      onPress={() => open({ kind: 'create' })}
      accessibilityLabel="New collection"
    >
      <Icon as={Plus} size={22} />
    </Button>
  );

  return (
    <Screen header={<ScreenHeader title="Collections" right={newButton} />}>
      <View className="gap-4">
        <Text className="px-1 text-sm leading-5 text-muted-foreground">
          Shared collections are visible to people who have your number saved. Private ones are just
          for you.
        </Text>

        {loading ? (
          <View className="gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </View>
        ) : (
          <View className="gap-3">
            {shelves.map((shelf, index) => (
              <ShelfCard
                key={shelf.id}
                shelf={shelf}
                count={counts[shelf.id] ?? 0}
                first={index === 0}
                last={index === shelves.length - 1}
                onlyOne={shelves.length === 1}
                busy={busy[shelf.id]}
                onTogglePublic={(v) => togglePublic(shelf, v)}
                onMove={(d) => void move(shelf, d)}
                onRename={() => open({ kind: 'rename', shelf })}
                onDelete={() => open({ kind: 'delete', shelf })}
              />
            ))}
          </View>
        )}

        <Button
          variant="outline"
          onPress={() => open({ kind: 'create' })}
          className="border-dashed"
        >
          <Icon as={Plus} size={16} />
          <Text>New collection</Text>
        </Button>
      </View>

      {dialog.kind === 'create' || dialog.kind === 'rename' ? (
        <ShelfFormDialog
          key={dialogKey}
          open
          onOpenChange={closeDialog}
          shelves={shelves}
          editing={dialog.kind === 'rename' ? dialog.shelf : null}
          onSubmit={async (v) => {
            try {
              if (dialog.kind === 'rename') {
                await renameShelf(dialog.shelf.id, v.name);
                toast.success('Collection renamed');
              } else {
                await createShelf({
                  uid,
                  name: v.name,
                  isPublic: v.isPublic,
                  sortOrder: nextSortOrder(shelves),
                });
                toast.success(`Created ${v.name}`);
              }
            } catch (e) {
              toastError(e);
              throw e;
            }
          }}
        />
      ) : null}

      <PendingRequestsSheet
        copy={makingPrivate?.copy ?? null}
        onClose={() => setMakingPrivate(null)}
        onConfirm={async () => {
          if (!makingPrivate) return;
          try {
            // Decline first (`notLending`), then make it private: nobody gets "Copy not found".
            await declinePendingRequests(makingPrivate.loanIds);
          } catch (e) {
            toastError(e);
            throw e;
          }
          await applyPublic(makingPrivate.shelf, false);
        }}
      />

      {dialog.kind === 'delete' ? (
        <DeleteShelfDialog
          key={dialogKey}
          open
          onOpenChange={closeDialog}
          shelf={dialog.shelf}
          others={shelves.filter((s) => s.id !== dialog.shelf.id)}
          count={counts[dialog.shelf.id] ?? 0}
          initialTargetId={defaultMoveTarget(shelves, dialog.shelf.id, defaultShelfId(uid))}
          onConfirm={async (moveTo) => {
            try {
              const res = await deleteShelf(dialog.shelf.id, moveTo);
              const target = shelves.find((s) => s.id === moveTo)?.name ?? 'another collection';
              toast.success(
                res.moved
                  ? `Deleted ${dialog.shelf.name}. ${books(res.moved)} moved to ${target}.`
                  : `Deleted ${dialog.shelf.name}`
              );
            } catch (e) {
              toastError(e);
              throw e;
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

function ShelfCard({
  shelf,
  count,
  first,
  last,
  onlyOne,
  busy,
  onTogglePublic,
  onMove,
  onRename,
  onDelete,
}: {
  shelf: WithId<Shelf>;
  count: number;
  first: boolean;
  last: boolean;
  onlyOne: boolean;
  busy?: 'visibility' | 'order';
  onTogglePublic(isPublic: boolean): void;
  onMove(direction: 'up' | 'down'): void;
  onRename(): void;
  onDelete(): void;
}) {
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card shadow-sm shadow-black/5">
      <View className="flex-row items-center gap-3 p-3 pl-4">
        <View
          className={cn(
            'size-10 items-center justify-center rounded-lg',
            shelf.isPublic ? 'bg-emerald-500/15' : 'bg-muted'
          )}
        >
          <Icon
            as={shelf.isPublic ? Globe : Lock}
            size={18}
            className={
              shelf.isPublic ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
            }
          />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold" numberOfLines={1}>
            {shelf.name}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {books(count)} · {shelf.isPublic ? 'Shared' : 'Private'}
          </Text>
        </View>
        {busy === 'order' ? <ActivityIndicator size="small" /> : null}
        <View className="flex-row">
          <OrderButton
            icon={ChevronUp}
            label={`Move ${shelf.name} up`}
            disabled={first || !!busy}
            onPress={() => onMove('up')}
          />
          <OrderButton
            icon={ChevronDown}
            label={`Move ${shelf.name} down`}
            disabled={last || !!busy}
            onPress={() => onMove('down')}
          />
        </View>
      </View>
      <Separator />
      <View className="flex-row items-center gap-2 py-2 pl-4 pr-2">
        <View className="flex-1 flex-row items-center gap-2.5">
          {busy === 'visibility' ? (
            <ActivityIndicator size="small" />
          ) : (
            <Switch
              checked={shelf.isPublic}
              onCheckedChange={onTogglePublic}
              disabled={!!busy}
              accessibilityLabel={`Share ${shelf.name} with contacts`}
            />
          )}
          <Text className="text-sm text-muted-foreground">Share with contacts</Text>
        </View>
        <Button
          variant="ghost"
          size="sm"
          onPress={onRename}
          accessibilityLabel={`Rename ${shelf.name}`}
        >
          <Icon as={Pencil} size={14} />
          <Text>Rename</Text>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onPress={onDelete}
          disabled={onlyOne}
          accessibilityLabel={onlyOne ? 'You need at least one collection' : `Delete ${shelf.name}`}
        >
          <Icon as={Trash2} size={14} className="text-destructive" />
          <Text className="text-destructive">Delete</Text>
        </Button>
      </View>
    </View>
  );
}

function OrderButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof ChevronUp;
  label: string;
  disabled: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        'size-9 items-center justify-center rounded-full active:bg-accent',
        disabled && 'opacity-30'
      )}
    >
      <Icon as={icon} size={18} className="text-foreground" />
    </Pressable>
  );
}
