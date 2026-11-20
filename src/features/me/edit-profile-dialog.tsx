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
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast, toastError } from '@/lib/toast';
import { LIMITS } from '@/types/model';

export interface EditProfileDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  name: string;
  pickupNote: string | null;
}

/** Edit name and pickup note (`completeProfile`). */
export function EditProfileDialog(props: EditProfileDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {props.open ? <EditProfileBody {...props} /> : null}
    </Dialog>
  );
}

function EditProfileBody({ onOpenChange, name: initialName, pickupNote }: EditProfileDialogProps) {
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState(pickupNote ?? '');
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();
  const nameError =
    trimmed.length === 0
      ? 'Enter your name.'
      : trimmed.length > LIMITS.profileName
        ? `Keep it under ${LIMITS.profileName} characters.`
        : null;
  const noteTooLong = note.trim().length > LIMITS.pickupNote;
  const unchanged = trimmed === initialName && note.trim() === (pickupNote ?? '');

  const save = async () => {
    if (nameError || noteTooLong) return;
    setSaving(true);
    try {
      await api.completeProfile({ name: trimmed, pickupNote: note.trim() || null });
      toast.success('Profile updated');
      onOpenChange(false);
    } catch (e) {
      toastError(e, 'Couldn’t save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="gap-5">
      <DialogHeader>
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>
          People who have your number see this name when they don’t have you saved under one.
        </DialogDescription>
      </DialogHeader>

      <View className="gap-2">
        <Label nativeID="profile-name">Name</Label>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          maxLength={LIMITS.profileName + 10}
          aria-labelledby="profile-name"
          aria-invalid={!!nameError && name.length > 0}
        />
        {nameError && name.length > 0 ? (
          <Text className="text-xs text-destructive">{nameError}</Text>
        ) : null}
      </View>

      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Label nativeID="pickup-note">Pickup note</Label>
          <Text
            className={noteTooLong ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
          >
            {note.trim().length}/{LIMITS.pickupNote}
          </Text>
        </View>
        <Textarea
          value={note}
          onChangeText={setNote}
          placeholder="e.g. My place in Indiranagar, weekends are best"
          numberOfLines={3}
          aria-labelledby="pickup-note"
          aria-invalid={noteTooLong}
        />
        <Text className="text-xs text-muted-foreground">
          Shown on your books so borrowers know where and when to pick them up.
        </Text>
      </View>

      <DialogFooter>
        <Button variant="outline" onPress={() => onOpenChange(false)} disabled={saving}>
          <Text>Cancel</Text>
        </Button>
        <Button onPress={save} disabled={saving || !!nameError || noteTooLong || unchanged}>
          {saving ? <ActivityIndicator size="small" /> : null}
          <Text>Save</Text>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
