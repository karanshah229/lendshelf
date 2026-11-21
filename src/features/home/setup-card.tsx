/**
 * The setup card (UX §E2a): "Get set up · n of 3" with Find your people · Add your books · Set
 * your pickup spot, one filled primary (the first unfinished step), × once two are done.
 * Hidden while Needs you has cards (R13). With an empty circle it is Home's empty state, with
 * the copy for the user's case: nobody found yet (invite) or contacts off (turn them on).
 */
import { router } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { openContactsSettings } from '@/features/contacts/use-auto-resync';
import {
  addBooksLabel,
  setupBooksLine,
  syncErrorText,
  type SetupCopy,
} from '@/features/first-run/first-run';
import type { SetupCardState, SetupStep } from '@/features/home/home';
import { useInvite } from '@/features/invite/use-invite';
import { EditProfileDialog } from '@/features/me/edit-profile-dialog';
import { joinNames, shortName } from '@/features/shared/people';
import { errorCode } from '@/lib/errors';
import { syncContactsNow } from '@/lib/sync-contacts';
import { toast } from '@/lib/toast';
import { useDismissedStore } from '@/stores/dismissed';

/** Key in the dismissed store. */
export const SETUP_DISMISS_KEY = 'setup';

const STEP_LABEL: Record<SetupStep, string> = {
  people: 'Find your people',
  books: 'Add your books',
  pickup: 'Set your pickup spot',
};

/** Scanning needs a camera; the web build searches instead (E2a). */
const CAN_SCAN = Platform.OS !== 'web';

export function SetupCard({
  state,
  copy,
  friendNames,
  profileName,
  pickupNote,
}: {
  state: SetupCardState;
  /** Title, body and the people step's action for the user's case (E2a). */
  copy: SetupCopy;
  /** Names of the people I saved, for the line under Add your books (`setupBooksLine`). */
  friendNames: readonly string[];
  profileName: string;
  pickupNote: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const invite = useInvite();

  const runPeople = async () => {
    switch (copy.peopleAction) {
      case 'invite':
        await invite();
        return;
      case 'openSettings':
        openContactsSettings();
        return;
      case 'askContacts':
        router.push('/contacts');
        return;
      case 'retry':
        setRetrying(true);
        try {
          const res = await syncContactsNow();
          if (res.status !== 'synced') router.push('/contacts');
        } catch (e) {
          toast.error(syncErrorText(errorCode(e)));
        } finally {
          setRetrying(false);
        }
    }
  };
  const run = (step: SetupStep) => {
    if (step === 'people') void runPeople();
    else if (step === 'books') {
      router.push({ pathname: '/add', params: { mode: CAN_SCAN ? 'scan' : 'search' } });
    } else setEditing(true);
  };
  const primaryLabel =
    state.primary === 'people'
      ? copy.peopleActionLabel
      : state.primary === 'books'
        ? addBooksLabel(CAN_SCAN)
        : STEP_LABEL.pickup;
  const title = copy.title ?? `Get set up · ${state.done} of 3`;
  const booksLine = setupBooksLine(
    joinNames(
      friendNames.map((n) => shortName(n) || n),
      2
    )
  );

  return (
    <Card className="gap-3 px-4 py-4">
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold" role="heading">
            {title}
          </Text>
          {copy.body ? (
            <Text className="text-sm leading-5 text-muted-foreground">{copy.body}</Text>
          ) : null}
        </View>
        {state.canDismiss ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onPress={() => useDismissedStore.getState().dismiss(SETUP_DISMISS_KEY)}
            accessibilityLabel="Dismiss setup"
          >
            <Icon as={X} size={18} className="text-muted-foreground" />
          </Button>
        ) : null}
      </View>

      <View className="gap-2">
        {state.steps.map(({ step, done }) => (
          <View
            key={step}
            className="flex-row items-center gap-3"
            accessible
            accessibilityLabel={[
              STEP_LABEL[step],
              done ? 'done' : 'not done yet',
              step === 'books' && !done ? booksLine : null,
            ]
              .filter(Boolean)
              .join(', ')}
          >
            <View
              className={
                done
                  ? 'size-8 items-center justify-center rounded-full bg-emerald-500/15'
                  : 'size-8 items-center justify-center rounded-full border border-border'
              }
            >
              {done ? (
                <Icon as={Check} size={14} className="text-emerald-700 dark:text-emerald-400" />
              ) : null}
            </View>
            <View className="flex-1">
              <Text className={done ? 'text-sm text-muted-foreground' : 'text-sm font-medium'}>
                {STEP_LABEL[step]}
              </Text>
              {step === 'books' && !done && booksLine ? (
                <Text className="text-xs text-muted-foreground">{booksLine}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <Button className="min-h-12" disabled={retrying} onPress={() => run(state.primary)}>
        <Text>{retrying ? 'Checking…' : primaryLabel}</Text>
      </Button>

      <EditProfileDialog
        open={editing}
        onOpenChange={setEditing}
        name={profileName}
        pickupNote={pickupNote}
      />
    </Card>
  );
}
