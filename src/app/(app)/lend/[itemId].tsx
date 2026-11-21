import { router, useLocalSearchParams } from 'expo-router';
import { BookX, Check, CircleAlert, Clock, MessageCircle, UserPlus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { lentMessage, type Borrower } from '@/features/lend/borrowers';
import { BorrowerPicker } from '@/features/lend/components/borrower-picker';
import { DueDatePicker } from '@/features/lend/components/due-date-picker';
import { defaultDueDate, dueDateToIso, relativeDueLabel } from '@/features/lend/due-date';
import { useInvite } from '@/features/invite/use-invite';
import { lendDeclinesWarning } from '@/features/loans/requests';
import { askForPushInContext } from '@/features/push-ask/ask';
import { useLoanPeople } from '@/features/loans/use-loan-people';
import { shortName } from '@/features/shared/people';
import { requestsOnItems } from '@/features/shelves/pending-requests';
import { useProfile, useUid } from '@/hooks/use-auth';
import { useItem } from '@/hooks/use-items';
import { useMyLoans } from '@/hooks/use-loans';
import { api } from '@/lib/api';
import { backLabel, formatShortDate } from '@/lib/dates';
import { toastError } from '@/lib/toast';
import { waLink } from '@/lib/whatsapp';
import type { Item, WithId } from '@/types/model';

const close = () => (router.canGoBack() ? router.back() : router.replace('/my-books'));

/** Owner lends a copy to an app contact, a phone contact, or anyone typed in; with a due date. */
export default function LendScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const uid = useUid();
  const { item, loading } = useItem(itemId);
  const [done, setDone] = useState<{ borrower: Borrower; due: Date; title: string } | null>(null);

  let body: React.ReactNode;
  if (done) {
    body = <LentSuccess {...done} />;
  } else if (loading) {
    body = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  } else if (!item || item.ownerId !== uid) {
    body = (
      <EmptyState
        icon={BookX}
        title="Can’t lend this book"
        description="Only the owner of a copy can lend it."
      >
        <Button variant="outline" onPress={close}>
          <Text>Close</Text>
        </Button>
      </EmptyState>
    );
  } else if (item.loanState === 'lent') {
    body = (
      <EmptyState
        icon={Clock}
        title="Already lent out"
        description={`“${item.title}” is out right now (${backLabel(item.dueDate?.toDate() ?? null)}). Mark it returned first.`}
      >
        <Button variant="outline" onPress={close}>
          <Text>Close</Text>
        </Button>
      </EmptyState>
    );
  } else {
    body = <LendForm item={item} onLent={setDone} />;
  }

  return (
    <Screen
      scroll={false}
      keyboard
      safeBottom={false}
      header={<ScreenHeader title={done ? 'Lent' : 'Lend'} back={close} />}
    >
      {body}
    </Screen>
  );
}

function LendForm({
  item,
  onLent,
}: {
  item: WithId<Item>;
  onLent(r: { borrower: Borrower; due: Date; title: string }): void;
}) {
  const insets = useSafeAreaInsets();
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [due, setDue] = useState(() => defaultDueDate());
  const [saving, setSaving] = useState(false);
  // recordLoan declines open requests for this copy (E7): say who, before Lend.
  const { incomingRequests } = useMyLoans();
  const requests = useMemo(
    () => requestsOnItems(incomingRequests, [item.id]),
    [incomingRequests, item.id]
  );
  const people = useLoanPeople(requests);
  const warning = lendDeclinesWarning(requests.map((l) => people.name(l)));

  const submit = async () => {
    if (!borrower) return;
    setSaving(true);
    try {
      await api.recordLoan({
        itemId: item.id,
        borrowerName: borrower.name.slice(0, 60),
        ...(borrower.phone ? { borrowerPhone: borrower.phone } : {}),
        dueDate: dueDateToIso(due),
      });
      onLent({ borrower, due, title: item.title });
      // C11: a recorded loan has a due date to be reminded about.
      void askForPushInContext('lend', { name: borrower.name, title: item.title });
    } catch (e) {
      toastError(e, 'Couldn’t record the loan. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pb-8 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center gap-3">
          <BookCover uri={item.coverUrl} title={item.title} size="sm" />
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-semibold leading-5" numberOfLines={2}>
              {item.title}
            </Text>
            {item.authors.length ? (
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {item.authors.join(', ')}
              </Text>
            ) : null}
          </View>
        </View>

        {warning ? (
          <View
            className="flex-row gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3"
            accessibilityRole="alert"
          >
            <Icon
              as={CircleAlert}
              size={16}
              className="mt-0.5 text-amber-700 dark:text-amber-400"
            />
            <Text className="flex-1 text-sm leading-5">{warning}</Text>
          </View>
        ) : null}

        <View className="gap-2.5">
          <Text className="text-sm font-semibold">Who’s borrowing it?</Text>
          <BorrowerPicker value={borrower} onChange={setBorrower} />
        </View>

        <View className="gap-2.5">
          <Text className="text-sm font-semibold">When should it come back?</Text>
          <DueDatePicker value={due} onChange={setDue} />
        </View>
      </ScrollView>

      <View
        className="border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button size="lg" disabled={!borrower || saving} onPress={() => void submit()}>
          {saving ? <ActivityIndicator size="small" color="#888" /> : null}
          <Text>
            {saving
              ? 'Lending…'
              : borrower
                ? `Lend to ${shortName(borrower.name)}`
                : 'Choose who’s borrowing it'}
          </Text>
        </Button>
      </View>
    </View>
  );
}

function LentSuccess({ borrower, due, title }: { borrower: Borrower; due: Date; title: string }) {
  const insets = useSafeAreaInsets();
  const invite = useInvite();
  const firstName = shortName(borrower.name) || borrower.name;
  // Greet by their profile name (R21); someone not on the app gets "Hi!".
  const { profile } = useProfile(borrower.uid);
  const openWhatsApp = () => {
    if (!borrower.phone) return;
    const url = waLink(
      borrower.phone,
      lentMessage({
        borrowerName: borrower.uid ? (profile?.name ?? null) : null,
        title,
        dueDate: due,
      })
    );
    Linking.openURL(url).catch((e: unknown) => toastError(e, 'Couldn’t open WhatsApp.'));
  };

  return (
    <View className="flex-1 px-6" style={{ paddingBottom: insets.bottom + 16 }}>
      <View className="flex-1 items-center justify-center gap-5">
        <View className="size-16 items-center justify-center rounded-full bg-emerald-500/15">
          <Icon as={Check} size={30} className="text-emerald-600 dark:text-emerald-400" />
        </View>
        <View className="items-center gap-1.5">
          <Text className="text-center text-xl font-bold tracking-tight">
            Lent to {borrower.name}
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            “{title}” is due back {formatShortDate(due)} ({relativeDueLabel(due)}).
            {borrower.uid ? ' They’ll see it in their Loans tab.' : ''}
          </Text>
        </View>
        {borrower.uid ? null : (
          // E2: lending to someone not on the app is a natural moment to invite them.
          <View className="w-full items-center gap-2 rounded-xl border border-border px-4 py-4">
            <Text className="text-center text-sm">
              {firstName} isn’t on LendShelf. Invite them?
            </Text>
            <Button
              variant="outline"
              className="min-h-12"
              onPress={() => void invite(borrower.phone)}
              accessibilityLabel={`Invite ${firstName} to LendShelf`}
            >
              <Icon as={UserPlus} size={16} />
              <Text>Invite {firstName}</Text>
            </Button>
          </View>
        )}
      </View>
      <View className="gap-2">
        {borrower.phone ? (
          <Button size="lg" className="bg-[#25D366] active:bg-[#1ebe5b]" onPress={openWhatsApp}>
            <Icon as={MessageCircle} size={18} className="text-white" />
            <Text className="text-white">Tell them on WhatsApp</Text>
          </Button>
        ) : null}
        <Button size="lg" variant={borrower.phone ? 'outline' : 'default'} onPress={close}>
          <Text>Done</Text>
        </Button>
      </View>
    </View>
  );
}
