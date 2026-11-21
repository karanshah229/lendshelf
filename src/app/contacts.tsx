import { router } from 'expo-router';
import {
  Check,
  EyeOff,
  Lock,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';

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
import { useUid } from '@/hooks/use-auth';
import {
  getContactsPermission,
  HAS_ADDRESS_BOOK,
  presentLimitedAccessPicker,
  requestContactsPermission,
  type ContactsPermission,
  type DeviceContact,
} from '@/lib/contacts';
import { timeAgo } from '@/lib/dates';
import { USE_EMULATORS } from '@/lib/firebase';
import { formatPhone, normalisePhone, type CountryCode } from '@/lib/phone';
import { syncContactsNow } from '@/lib/sync-contacts';
import { toast, toastError } from '@/lib/toast';
import { useContactsStore } from '@/stores/contacts';

/** Demo numbers matching the seed script's users (web / emulator only). */
const DEMO_CONTACTS: DeviceContact[] = [
  { name: 'Asha Rao', phone: '+919000000001' },
  { name: 'Ravi Menon', phone: '+919000000002' },
  { name: 'Meera Iyer', phone: '+919000000003' },
  { name: 'Kabir Shah', phone: '+919000000004' },
  { name: 'Zoya Khan', phone: '+919000000005' },
];

export default function ContactsScreen() {
  const uid = useUid();
  const onboarding = useContactsStore((s) => !s.onboarded[uid]);
  const syncing = useContactsStore((s) => s.syncing);
  const linkCount = useContactsStore((s) => s.linkCount);
  const lastSyncedAt = useContactsStore((s) => s.lastSyncedAt);
  const [permission, setPermission] = useState<ContactsPermission | null>(null);

  useEffect(() => {
    void getContactsPermission().then(setPermission);
  }, []);

  const finish = useCallback(() => {
    useContactsStore.getState().markOnboarded(uid);
    router.replace('/');
  }, [uid]);

  const sync = useCallback(async (): Promise<boolean> => {
    try {
      const res = await syncContactsNow();
      if (res.status === 'noPermission') {
        toast.error('LendShelf needs access to your contacts to find people.');
        return false;
      }
      if (res.status === 'skipped') {
        if (HAS_ADDRESS_BOOK) {
          // An empty address book isn't an error worth blocking onboarding on.
          toast('No phone numbers in your contacts yet. You can sync later from Me.');
          return true;
        }
        toast.error('Add a contact first.');
        return false;
      }
      const n = res.links.length;
      toast.success(
        n === 0
          ? 'No one from your contacts is on LendShelf yet'
          : `Found ${n} ${n === 1 ? 'person' : 'people'} on LendShelf`
      );
      if (res.truncated) toast.warning('Only the first 5,000 numbers were checked.');
      return true;
    } catch (e) {
      toastError(e, 'Couldn’t sync your contacts. Please try again.');
      return false;
    }
  }, []);

  const allow = async () => {
    const p = await requestContactsPermission();
    setPermission(p);
    if (p === 'granted' || p === 'limited') {
      const ok = await sync();
      if (ok && onboarding) finish();
    }
  };

  const canSync = !HAS_ADDRESS_BOOK || permission === 'granted' || permission === 'limited';

  const primary: ReactNode = (() => {
    if (HAS_ADDRESS_BOOK && permission === 'undetermined') {
      return (
        <Button size="lg" onPress={allow} disabled={syncing}>
          <Icon as={Users} size={18} />
          <Text>Allow access to contacts</Text>
        </Button>
      );
    }
    if (HAS_ADDRESS_BOOK && permission === 'denied') {
      return (
        <Button size="lg" variant="outline" onPress={() => void Linking.openSettings()}>
          <Icon as={Settings} size={18} />
          <Text>Open Settings</Text>
        </Button>
      );
    }
    return (
      <Button
        size="lg"
        disabled={syncing || permission === null}
        onPress={async () => {
          const ok = await sync();
          if (ok && onboarding) finish();
        }}
      >
        {syncing ? <ActivityIndicator size="small" /> : <Icon as={RefreshCw} size={18} />}
        <Text>{syncing ? 'Syncing…' : onboarding ? 'Sync and continue' : 'Sync now'}</Text>
      </Button>
    );
  })();

  return (
    <AuthShell
      icon={Users}
      title={onboarding ? 'Find your people' : 'Contacts'}
      description="LendShelf shows you books shared by people whose numbers you have saved. It checks which of your contacts use the app."
      step={onboarding ? { current: 4, total: 4 } : undefined}
      back={onboarding ? false : undefined}
      footer={
        <>
          {primary}
          {onboarding ? (
            <Button variant="ghost" onPress={finish} disabled={syncing}>
              <Text className="text-muted-foreground">Skip for now</Text>
            </Button>
          ) : null}
        </>
      }
    >
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

      {lastSyncedAt ? (
        <View className="flex-row items-center gap-2">
          <Badge variant="success">
            <Icon as={Check} size={12} />
            <Text>
              {linkCount} {linkCount === 1 ? 'person' : 'people'} found
            </Text>
          </Badge>
          <Text className="text-xs text-muted-foreground">Last synced {timeAgo(lastSyncedAt)}</Text>
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
              if (await presentLimitedAccessPicker()) await sync();
            }}
          >
            <Icon as={UserPlus} size={16} />
            <Text>Choose more contacts</Text>
          </Button>
        </View>
      ) : null}

      {HAS_ADDRESS_BOOK && permission === 'denied' ? (
        <Text className="text-sm text-muted-foreground">
          Contacts access is turned off. You can turn it on in Settings, or skip for now and do it
          later from the Me tab.
        </Text>
      ) : null}

      {!HAS_ADDRESS_BOOK && canSync ? <ManualContacts /> : null}
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

/** Web has no address book: add numbers by hand (or use the demo contacts in emulator mode). */
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
        <View className="flex-row gap-2">
          <Button variant="secondary" className="flex-1" onPress={add} disabled={!number.trim()}>
            <Icon as={Plus} size={16} />
            <Text>Add contact</Text>
          </Button>
          {USE_EMULATORS ? (
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => {
                useContactsStore.getState().addManualContacts(DEMO_CONTACTS);
                toast.success('Added 5 demo contacts');
              }}
            >
              <Icon as={Sparkles} size={16} />
              <Text>Use demo contacts</Text>
            </Button>
          ) : null}
        </View>
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
