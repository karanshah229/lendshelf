import { Download, MessageCircle, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

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
import { ExportDialog } from '@/features/export/export-dialog';
import { leavingMessage, openWhatsApp } from '@/features/loans/messages';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import { deleteAccountAndSignOut } from '@/features/me/account';
import { DELETE_CONFIRMATION, isDeleteConfirmed } from '@/features/me/delete-confirmation';
import {
  deleteCheckIntro,
  deletePrecheck,
  openRequestsLine,
  outWithFriendsLine,
} from '@/features/me/delete-precheck';
import { useMyLoans } from '@/hooks/use-loans';
import { toast, toastError } from '@/lib/toast';
import { useSessionStore } from '@/stores/session';
import { shortName } from '@/features/shared/people';

/** Short name for UI labels; never cuts "Dr. Mehta" to "Dr." (QA B2). */
const first = shortName;

/**
 * "Delete account": a pre-check sheet built from live loans (E15, C6) — books out with friends
 * with a WhatsApp button each, books I have, open requests, Export — then the typed "DELETE".
 */
export function DeleteAccountButton() {
  const uid = useSessionStore((s) => s.user?.uid) ?? '';
  const { asOwner, asBorrower } = useMyLoans();
  const check = useMemo(() => deletePrecheck(uid, asOwner, asBorrower), [uid, asOwner, asBorrower]);
  const people = useLoanPeople(
    useMemo(() => [...check.outWithFriends, ...check.borrowing], [check])
  );

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'check' | 'confirm'>('check');
  const [exporting, setExporting] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const confirmed = isDeleteConfirmed(typed);

  const onOpenChange = (o: boolean) => {
    if (deleting) return;
    setOpen(o);
    if (!o) {
      setTyped('');
      setStep('check');
    }
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
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost">
            <Icon as={Trash2} size={16} className="text-destructive" />
            <Text className="text-destructive">Delete account</Text>
          </Button>
        </AlertDialogTrigger>
        {step === 'check' ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Before you delete your account</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteCheckIntro(check)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {/* pr-2: the web scrollbar must not cover the text (QA B21). */}
            <ScrollView
              style={{ maxHeight: 360 }}
              contentContainerClassName="gap-4 pr-2"
              // Inside the dialog frame's own ScrollView (Android needs this to scroll both).
              nestedScrollEnabled
            >
              {check.outWithFriends.length ? (
                <View className="gap-2">
                  <Text className="text-sm">{outWithFriendsLine(check.outWithFriends.length)}</Text>
                  {check.outWithFriends.map((l) => {
                    const name = people.name(l);
                    const phone = people.phone(l);
                    return (
                      <View
                        key={l.id}
                        className="flex-row items-center gap-2 rounded-lg border border-border px-3 py-1.5"
                      >
                        <Text className="flex-1 text-sm" numberOfLines={2}>
                          <Text className="text-sm font-semibold">{l.title}</Text> · with{' '}
                          {first(name)}
                        </Text>
                        {phone ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-11"
                            accessibilityLabel={`Tell ${first(name)} on WhatsApp`}
                            onPress={() =>
                              void openWhatsApp(
                                phone,
                                leavingMessage({
                                  borrowerName: people.greetName(l),
                                  title: l.title,
                                })
                              )
                            }
                          >
                            <Icon
                              as={MessageCircle}
                              size={14}
                              className="text-[#128C7E] dark:text-[#25D366]"
                            />
                            <Text>Tell {first(name)}</Text>
                          </Button>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}
              {check.borrowing.map((l) => (
                <Text key={l.id} className="text-sm">
                  You have <Text className="text-sm font-semibold">{l.title}</Text> from{' '}
                  {first(people.name(l))}. They’ll see that you left; your name stays on their
                  record.
                </Text>
              ))}
              {check.lentToNonApp.length ? (
                <Text className="text-sm">
                  {check.lentToNonApp.length === 1
                    ? `“${check.lentToNonApp[0]!.title}”, lent to someone who isn’t on LendShelf, is`
                    : `${check.lentToNonApp.length} books lent to people who aren’t on LendShelf are`}{' '}
                  deleted with your account.
                </Text>
              ) : null}
              {check.openRequests ? (
                <Text className="text-sm">{openRequestsLine(check.openRequests)}</Text>
              ) : null}
              <Button
                variant="outline"
                className="min-h-11 self-start"
                onPress={() => {
                  setOpen(false);
                  setExporting(true);
                }}
              >
                <Icon as={Download} size={15} />
                <Text>Export your books and loan history first</Text>
              </Button>
            </ScrollView>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text>Cancel</Text>
              </AlertDialogCancel>
              <Button variant="destructive" onPress={() => setStep('confirm')}>
                <Text>Continue</Text>
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your books, collections, reviews, wishlist, contact matches
                and profile. People who have your books see that you left LendShelf. People who lent
                you a book keep your name and number so they can get it back. This can’t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <View className="gap-2">
              <Text className="text-sm">
                Type <Text className="font-mono font-semibold">{DELETE_CONFIRMATION}</Text> to
                confirm.
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
        )}
      </AlertDialog>
      <ExportDialog open={exporting} onOpenChange={setExporting} />
    </>
  );
}
