import { router } from 'expo-router';
import {
  Check,
  CircleAlert,
  EyeOff,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCw,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { PhoneInput } from '@/components/phone-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useManualSync } from '@/features/contacts/use-manual-sync';
import { newPeopleLine } from '@/features/contacts/resync';
import { openContactsSettings } from '@/features/contacts/use-auto-resync';
import {
  CONTACTS_OFF_COPY,
  contactsResultCopy,
  type ContactsAction,
} from '@/features/first-run/first-run';
import { useInvite } from '@/features/invite/use-invite';
import { PersonAvatar } from '@/features/shared/ui';
import { useUid } from '@/hooks/use-auth';
import { useNetworkItems } from '@/hooks/use-items';
import { useLinks } from '@/hooks/use-links';
import {
  getContactsPermission,
  HAS_ADDRESS_BOOK,
  presentLimitedAccessPicker,
  requestContactsPermission,
  type ContactsPermission,
} from '@/lib/contacts';
import type { SyncedLink } from '@/lib/api';
import { announce, sentences } from '@/lib/a11y';
import { timeAgo } from '@/lib/dates';
import { formatPhone, normalisePhone, type CountryCode } from '@/lib/phone';
import { toast } from '@/lib/toast';
import { isOnboarded, useContactsStore } from '@/stores/contacts';

const granted = (p: ContactsPermission | null) => p === 'granted' || p === 'limited';
const AVATARS_SHOWN = 5;

/**
 * Find your people (onboarding step 4, UX §E1/§E2a) and, later, Me › Contacts.
 * The sync result is shown on this screen, never only as a toast: who was found (case ii), or
 * the invite block (case i). With contacts off (case iii): Open Settings / Continue without;
 * coming back from Settings with access granted syncs right away.
 */
export default function ContactsScreen() {
  const uid = useUid();
  const onboarding = useContactsStore((s) => !isOnboarded(s.onboarded, uid));
  const syncing = useContactsStore((s) => s.syncing);
  const linkCount = useContactsStore((s) => s.linkCount);
  const lastSyncedAt = useContactsStore((s) => s.lastSyncedAt);
  const [permission, setPermission] = useState<ContactsPermission | null>(null);
  /** The people the sync on this visit found (null: no sync finished yet). */
  const [found, setFound] = useState<SyncedLink[] | null>(null);
  const synced = found !== null;
  const nameByPhone = useContactsStore((s) => s.nameByPhone);
  const [error, setError] = useState<string | null>(null);
  const [newLine, setNewLine] = useState<string | null>(null);
  const manual = useManualSync();
  const invite = useInvite();
  const { links } = useLinks();
  const { items: networkItems, loading: itemsLoading } = useNetworkItems();
  const lastPermission = useRef<ContactsPermission | null>(null);

  const finish = useCallback(() => {
    useContactsStore.getState().markOnboarded(uid);
    router.replace('/');
  }, [uid]);

  const runSync = useCallback(async () => {
    setError(null);
    announce('Checking your contacts…');
    const res = await manual.sync();
    if (res.status === 'error') {
      setError(res.message);
      announce(res.message);
      return;
    }
    if (res.status === 'noPermission') {
      const p = await getContactsPermission();
      setPermission(p);
      lastPermission.current = p;
      return;
    }
    if (res.status === 'skipped') {
      if (!HAS_ADDRESS_BOOK) {
        setError('Add a contact first.');
        return;
      }
      // An empty address book: nobody to find (case i). Say so, so Sync now visibly did
      // something (QA two-phone run).
      setFound([]);
      setNewLine('Your address book has no phone numbers to check.');
      announce('Your address book has no phone numbers to check.');
      return;
    }
    setFound(res.links);
    const saved = useContactsStore.getState().nameByPhone;
    setNewLine(
      newPeopleLine(
        res.newLinks.map((l) => saved[l.ownerPhone] ?? l.name ?? formatPhone(l.ownerPhone))
      )
    );
    if (res.truncated) toast.warning('Only the first 5,000 numbers were checked.');
    // `manual` changes every render; its `sync` only reads module state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Records a permission check; returns the previous value. */
  const applyPermission = useCallback((p: ContactsPermission) => {
    useContactsStore.getState().setPermission(p);
    setPermission(p);
    const was = lastPermission.current;
    lastPermission.current = p;
    return was;
  }, []);

  useEffect(() => {
    void getContactsPermission().then((p) => {
      applyPermission(p);
      // Access was granted before (e.g. a reinstall): check right away during onboarding.
      if (HAS_ADDRESS_BOOK && granted(p) && onboarding) void runSync();
    });
    if (!HAS_ADDRESS_BOOK) return;
    // Back from Settings with access turned on: sync and show the result (E2a iii → i / ii).
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void getContactsPermission().then((p) => {
        const was = applyPermission(p);
        if (granted(p) && was !== null && !granted(was)) void runSync();
      });
    });
    return () => sub.remove();
    // Once per visit; `onboarding` only matters for the first check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyPermission, runSync]);

  const allow = async () => {
    const p = await requestContactsPermission();
    applyPermission(p);
    if (granted(p)) await runSync();
  };

  const act = (action: ContactsAction) => (action === 'invite' ? void invite() : finish());

  const off = HAS_ADDRESS_BOOK && permission === 'denied';
  const undetermined = HAS_ADDRESS_BOOK && permission === 'undetermined';
  // Names as saved in my contacts, else their profile name (like everywhere else).
  const foundNames = (found ?? []).map(
    (l) => nameByPhone[l.ownerPhone] ?? l.name ?? formatPhone(l.ownerPhone)
  );
  // Book count from the live listener once it has caught up with the sync.
  const circleReady = !itemsLoading && links.length >= foundNames.length;
  const result =
    found && !error
      ? contactsResultCopy({
          names: foundNames,
          bookCount: circleReady ? networkItems.length : null,
        })
      : null;

  // F8: the result that replaces "Checking…" is announced (it changes the title and body).
  const resultSummary =
    onboarding && result ? sentences([result.title, result.names]) : null;
  useEffect(() => {
    if (resultSummary) announce(resultSummary);
  }, [resultSummary]);

  // ---- Title and body for each state (E2a) ----
  let title: string;
  let description: ReactNode;
  if (onboarding && result) {
    title = result.title;
    description = result.body;
  } else if (off) {
    title = onboarding ? CONTACTS_OFF_COPY.title : 'Contacts are off';
    description = CONTACTS_OFF_COPY.body;
  } else {
    title = onboarding ? 'Find your people' : 'Contacts';
    description =
      'LendShelf shows you books shared by people whose numbers you have saved. It checks which of your contacts use the app.';
  }

  // ---- One primary, the rest secondary ----
  let primary: ReactNode;
  let secondary: ReactNode = null;
  const syncButton = (label: string) => (
    <Button size="lg" disabled={syncing || permission === null} onPress={() => void runSync()}>
      {syncing ? <ActivityIndicator size="small" /> : <Icon as={RefreshCw} size={18} />}
      <Text>{syncing ? 'Checking…' : label}</Text>
    </Button>
  );
  if (onboarding && result) {
    primary = (
      <Button size="lg" onPress={() => act(result.primary.action)}>
        {result.primary.action === 'invite' ? <Icon as={MessageCircle} size={18} /> : null}
        <Text>{result.primary.label}</Text>
      </Button>
    );
    secondary = result.secondary ? (
      <Button variant="ghost" className="min-h-12" onPress={() => act(result.secondary!.action)}>
        <Text className="text-muted-foreground">{result.secondary.label}</Text>
      </Button>
    ) : null;
  } else if (undetermined) {
    primary = (
      <Button size="lg" onPress={allow} disabled={syncing}>
        <Icon as={Users} size={18} />
        <Text>Allow access to contacts</Text>
      </Button>
    );
  } else if (off) {
    primary = (
      <Button size="lg" onPress={openContactsSettings}>
        <Icon as={Settings} size={18} />
        <Text>{CONTACTS_OFF_COPY.primary}</Text>
      </Button>
    );
  } else {
    primary = syncButton(onboarding ? 'Check my contacts' : 'Sync now');
  }
  if (onboarding && !result) {
    secondary = (
      <Button variant="ghost" className="min-h-12" onPress={finish} disabled={syncing}>
        <Text className="text-muted-foreground">
          {off || error ? CONTACTS_OFF_COPY.secondary : 'Skip for now'}
        </Text>
      </Button>
    );
  } else if (!onboarding) {
    secondary = (
      <Button variant="outline" className="min-h-12" onPress={() => void invite()}>
        <Icon as={UserPlus} size={16} />
        <Text>Invite friends</Text>
      </Button>
    );
  }

  const shown = foundNames.slice(0, AVATARS_SHOWN);

  return (
    <AuthShell
      icon={Users}
      title={title}
      description={description}
      step={onboarding ? { current: 4, total: 4 } : undefined}
      // A web deep link (reload) has no history: Back goes to Me instead of vanishing (QA B22).
      back={
        onboarding ? false : () => (router.canGoBack() ? router.back() : router.replace('/me'))
      }
      footer={
        <>
          {primary}
          {secondary}
          {manual.element}
        </>
      }
    >
      {onboarding && result ? (
        result.names ? (
          <Card className="gap-3 px-4 py-4">
            <View className="flex-row flex-wrap gap-2" accessibilityElementsHidden>
              {shown.map((name, i) => (
                <PersonAvatar key={`${i}-${name}`} name={name} size="lg" />
              ))}
            </View>
            <Text className="text-base font-medium">{result.names}</Text>
          </Card>
        ) : (
          <Card className="items-center gap-3 px-4 py-6">
            <View className="size-14 items-center justify-center rounded-full bg-muted">
              <Icon as={UserPlus} size={26} className="text-muted-foreground" />
            </View>
            <Text className="text-center text-sm text-muted-foreground">
              Friends see your shelf once they’ve saved your number, so the invite asks them to.
            </Text>
          </Card>
        )
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="gap-4 px-4 py-4">
            <PrivacyPoint icon={Lock} title="Only numbers are checked">
              Names and the rest of your address book never leave your phone.
            </PrivacyPoint>
            <Separator />
            <PrivacyPoint icon={EyeOff} title="Owners don’t see who saved them">
              Matching is one-way. If you have someone’s number, you see the books they share.
            </PrivacyPoint>
            <Separator />
            <PrivacyPoint icon={Sparkles} title="Names you know">
              People show up under the names you saved them as.
            </PrivacyPoint>
          </CardContent>
        </Card>
      )}

      {error ? (
        <View
          className="flex-row items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3"
          accessibilityRole="alert"
        >
          <Icon as={CircleAlert} size={16} className="text-amber-700 dark:text-amber-400" />
          <Text className="flex-1 text-sm leading-5">{error}</Text>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={syncing}
            onPress={() => void runSync()}
          >
            <Icon as={RotateCw} size={14} />
            <Text>Retry</Text>
          </Button>
        </View>
      ) : null}

      {!onboarding && lastSyncedAt ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge variant="success">
            <Icon as={Check} size={12} />
            <Text>
              {linkCount} {linkCount === 1 ? 'person' : 'people'} on LendShelf
            </Text>
          </Badge>
          <Text className="text-xs text-muted-foreground">Checked {timeAgo(lastSyncedAt)}</Text>
          {synced && newLine ? <Text className="w-full text-sm">{newLine}</Text> : null}
        </View>
      ) : null}

      {HAS_ADDRESS_BOOK && permission === 'limited' ? (
        <View className="gap-2">
          <Text className="text-sm text-muted-foreground">
            You’ve shared only some contacts with LendShelf.
          </Text>
          <Button
            variant="outline"
            onPress={async () => {
              if (await presentLimitedAccessPicker()) await runSync();
            }}
          >
            <Icon as={UserPlus} size={16} />
            <Text>Choose more contacts</Text>
          </Button>
        </View>
      ) : null}

      {!HAS_ADDRESS_BOOK && !(onboarding && result) ? <ManualContacts /> : null}
    </AuthShell>
  );
}

function PrivacyPoint({
  icon,
  title,
  children,
}: {
  icon: typeof Lock;
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="size-8 items-center justify-center rounded-full bg-muted">
        <Icon as={icon} size={16} className="text-muted-foreground" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-medium">{title}</Text>
        <Text className="text-sm leading-5 text-muted-foreground">{children}</Text>
      </View>
    </View>
  );
}

/** Web has no address book: add numbers by hand. */
function ManualContacts() {
  const contacts = useContactsStore((s) => s.manualContacts);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [country, setCountry] = useState<CountryCode>('IN');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const phone = normalisePhone(number, country);
    if (!phone) {
      setError('Enter a valid phone number.');
      return;
    }
    useContactsStore
      .getState()
      .addManualContacts([{ name: name.trim() || formatPhone(phone), phone }]);
    setName('');
    setNumber('');
    setError(null);
  };

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-base font-semibold">Your contacts</Text>
        <Text className="text-sm text-muted-foreground">
          The web version can’t read an address book, so add the people you know here.
        </Text>
      </View>

      <View className="gap-2">
        <Label nativeID="contact-name">Name</Label>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ravi"
          autoCapitalize="words"
          aria-labelledby="contact-name"
        />
        <Label nativeID="contact-phone">Phone number</Label>
        <PhoneInput
          country={country}
          onCountryChange={setCountry}
          value={number}
          onChangeText={(t) => {
            setNumber(t);
            setError(null);
          }}
          onSubmitEditing={add}
          invalid={!!error}
        />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
        <Button variant="secondary" onPress={add} disabled={!number.trim()}>
          <Icon as={Plus} size={16} />
          <Text>Add contact</Text>
        </Button>
      </View>

      {contacts.length ? (
        <Card className="gap-0 py-0">
          {contacts.map((c, i) => (
            <View key={c.phone}>
              {i > 0 ? <Separator /> : null}
              <View className="flex-row items-center gap-3 px-4 py-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium">{c.name}</Text>
                  <Text className="text-xs text-muted-foreground">{formatPhone(c.phone)}</Text>
                </View>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  accessibilityLabel={`Remove ${c.name}`}
                  onPress={() => useContactsStore.getState().removeManualContact(c.phone)}
                >
                  <Icon as={X} size={16} className="text-muted-foreground" />
                </Button>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Text className="text-center text-sm text-muted-foreground">No contacts added yet.</Text>
      )}
    </View>
  );
}
