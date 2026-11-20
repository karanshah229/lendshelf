import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { deleteAccountAndSignOut } from '@/features/me/account';
import { DELETE_CONFIRMATION, isDeleteConfirmed } from '@/features/me/delete-confirmation';
import { toast, toastError } from '@/lib/toast';

/** "Delete account" button + AlertDialog with a typed "DELETE" confirmation. */
export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const confirmed = isDeleteConfirmed(typed);

  const onOpenChange = (o: boolean) => {
    if (deleting) return;
    setOpen(o);
    if (!o) setTyped('');
  };

  const remove = async () => {
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteAccountAndSignOut();
      toast.success('Your account and data were deleted');
    } catch (e) {
      toastError(e, 'Couldn’t delete your account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost">
          <Icon as={Trash2} size={16} className="text-destructive" />
          <Text className="text-destructive">Delete account</Text>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes your books, collections, reviews, wishlist, contact matches and
            profile. Open loans are closed. People who lent you a book keep your name and number so
            they can get it back. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <View className="gap-2">
          <Text className="text-sm">
            Type <Text className="font-mono font-semibold">{DELETE_CONFIRMATION}</Text> to confirm.
          </Text>
          <Input
            value={typed}
            onChangeText={setTyped}
            placeholder={DELETE_CONFIRMATION}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
            accessibilityLabel={`Type ${DELETE_CONFIRMATION} to confirm`}
          />
        </View>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>
            <Text>Cancel</Text>
          </AlertDialogCancel>
          {/* A plain Button (not AlertDialogAction) so the dialog stays open while deleting. */}
          <Button variant="destructive" onPress={remove} disabled={!confirmed || deleting}>
            {deleting ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text>{deleting ? 'Deleting…' : 'Delete everything'}</Text>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
