import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Chip } from '@/features/library/components/chip';
import { cleanShelfName, validateShelfName } from '@/features/shelves/logic';
import { cn } from '@/lib/utils';
import { LIMITS, type Shelf, type WithId } from '@/types/model';

export interface ShelfFormValue {
  name: string;
  isPublic: boolean;
}

/** Create (name + public/private) or rename a collection. Mount with a `key` to reset. */
export function ShelfFormDialog({
  open,
  onOpenChange,
  shelves,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  shelves: WithId<Shelf>[];
  /** The shelf being renamed; omit to create. */
  editing?: WithId<Shelf> | null;
  onSubmit(value: ShelfFormValue): Promise<void>;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [isPublic, setIsPublic] = useState(editing?.isPublic ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const problem = validateShelfName(name, shelves, editing?.id);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: cleanShelfName(name), isPublic });
      onOpenChange(false);
    } catch {
      // The caller already showed the error; keep the dialog open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Rename collection' : 'New collection'}</DialogTitle>
          {!editing ? (
            <DialogDescription>
              Group your books, e.g. “Kids’ room” or “Cookbooks”.
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <View className="gap-1.5">
          <Label nativeID="shelf-name">Name</Label>
          <Input
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
            onSubmitEditing={() => void submit()}
            placeholder="Collection name"
            maxLength={LIMITS.shelfName + 10}
            autoFocus
            autoCapitalize="sentences"
            returnKeyType="done"
            aria-labelledby="shelf-name"
            className={cn(error && 'border-destructive')}
          />
          {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
        </View>
        {!editing ? (
          <View className="flex-row items-center gap-3 rounded-lg border border-border p-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-medium">Share with contacts</Text>
              <Text className="text-xs text-muted-foreground">
                {isPublic
                  ? 'People who have your number saved can see these books.'
                  : 'Private: only you can see these books.'}
              </Text>
            </View>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </View>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)} disabled={saving}>
            <Text>Cancel</Text>
          </Button>
          <Button onPress={() => void submit()} disabled={saving}>
            {saving ? <ActivityIndicator size="small" /> : null}
            <Text>{editing ? 'Save' : 'Create'}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Delete a collection after choosing where its books go. */
export function DeleteShelfDialog({
  open,
  onOpenChange,
  shelf,
  others,
  count,
  initialTargetId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  shelf: WithId<Shelf>;
  others: WithId<Shelf>[];
  count: number;
  initialTargetId: string | null;
  onConfirm(moveToShelfId: string): Promise<void>;
}) {
  const [targetId, setTargetId] = useState(initialTargetId);
  const [busy, setBusy] = useState(false);
  const target = others.find((s) => s.id === targetId) ?? null;

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await onConfirm(target.id);
      onOpenChange(false);
    } catch {
      // The caller already showed the error; keep the dialog open.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={busy ? () => undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{shelf.name}”?</DialogTitle>
          <DialogDescription>
            {count
              ? `Its ${count === 1 ? 'book moves' : `${count} books move`} to the collection you pick. No books are deleted.`
              : 'This collection is empty.'}
          </DialogDescription>
        </DialogHeader>
        {count ? (
          <View className="gap-2">
            <Text className="text-sm font-medium">Move books to</Text>
            <View className="flex-row flex-wrap gap-2">
              {others.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  icon={s.isPublic ? undefined : Lock}
                  selected={s.id === targetId}
                  onPress={() => setTargetId(s.id)}
                />
              ))}
            </View>
            {target && shelf.isPublic !== target.isPublic ? (
              <Text className="text-xs text-muted-foreground">
                {target.isPublic
                  ? `${target.name} is shared, so contacts will be able to see these books.`
                  : `${target.name} is private, so contacts won’t see these books any more.`}
              </Text>
            ) : null}
          </View>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)} disabled={busy}>
            <Text>Cancel</Text>
          </Button>
          <Button variant="destructive" onPress={() => void confirm()} disabled={busy || !target}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text>Delete collection</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
