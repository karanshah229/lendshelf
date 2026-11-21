import { BookUser, Check, Search, UserPlus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { buildBorrowerOptions, type Borrower } from '@/features/lend/borrowers';
import { useDeviceContacts } from '@/features/lend/use-device-contacts';
import { initials } from '@/features/shared/people';
import { useLinks } from '@/hooks/use-links';
import { deviceRegion, HAS_ADDRESS_BOOK } from '@/lib/contacts';
import { formatPhone, normalisePhoneLenient } from '@/lib/phone';
import { cn } from '@/lib/utils';

const MAX_CONTACT_ROWS = 40;

/**
 * Pick who borrows the book: people on LendShelf I have saved, any phone contact,
 * or someone typed in by name (and optionally number).
 */
export function BorrowerPicker({
  value,
  onChange,
}: {
  value: Borrower | null;
  onChange(b: Borrower | null): void;
}) {
  const { links } = useLinks();
  const device = useDeviceContacts();
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);

  const options = useMemo(
    () => buildBorrowerOptions(links, device.contacts, query),
    [links, device.contacts, query]
  );

  if (value) return <SelectedBorrower borrower={value} onClear={() => onChange(null)} />;
  if (typing)
    return (
      <ManualBorrower
        initialName={query}
        onCancel={() => setTyping(false)}
        onDone={(b) => {
          setTyping(false);
          onChange(b);
        }}
      />
    );

  const shownContacts = options.contacts.slice(0, MAX_CONTACT_ROWS);
  const hiddenContacts = options.contacts.length - shownContacts.length;
  const nothing = !options.onApp.length && !options.contacts.length;

  return (
    <View className="gap-3">
      <View className="relative justify-center">
        <View className="absolute left-3 z-10" pointerEvents="none">
          <Icon as={Search} size={16} className="text-muted-foreground" />
        </View>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or number"
          autoCorrect={false}
          className="pl-9"
          accessibilityLabel="Search people"
        />
      </View>

      <View className="overflow-hidden rounded-xl border border-border bg-card">
        <PersonRow
          icon={UserPlus}
          title={query.trim() ? `Someone else: “${query.trim()}”` : 'Someone else'}
          subtitle="Type a name and, if you like, their number"
          onPress={() => setTyping(true)}
        />

        {options.onApp.length ? <SectionLabel>On LendShelf</SectionLabel> : null}
        {options.onApp.map((b) => (
          <PersonRow
            key={b.uid ?? b.phone ?? b.name}
            initials={initials(b.name)}
            title={b.name}
            subtitle={b.phone ? formatPhone(b.phone) : undefined}
            badge="On LendShelf"
            onPress={() => onChange(b)}
          />
        ))}

        {shownContacts.length ? (
          <SectionLabel>{HAS_ADDRESS_BOOK ? 'Your contacts' : 'Saved numbers'}</SectionLabel>
        ) : null}
        {shownContacts.map((b) => (
          <PersonRow
            key={b.phone ?? b.name}
            initials={initials(b.name)}
            title={b.name}
            subtitle={b.phone ? formatPhone(b.phone) : undefined}
            onPress={() => onChange(b)}
          />
        ))}
        {hiddenContacts > 0 ? (
          <Text className="px-4 py-3 text-xs text-muted-foreground">
            {hiddenContacts} more. Keep typing to narrow it down.
          </Text>
        ) : null}

        {HAS_ADDRESS_BOOK && device.status !== 'ready' ? (
          <View className="flex-row items-center gap-3 border-t border-border px-4 py-3">
            <Icon as={BookUser} size={18} className="text-muted-foreground" />
            <Text className="flex-1 text-xs leading-4 text-muted-foreground">
              {device.status === 'loading'
                ? 'Loading your contacts…'
                : device.status === 'needsPermission'
                  ? 'Pick anyone from your phone contacts.'
                  : device.status === 'denied'
                    ? 'Contacts access is off. You can still type a name.'
                    : 'Couldn’t read your contacts.'}
            </Text>
            {device.status === 'loading' ? <ActivityIndicator size="small" /> : null}
            {device.status === 'needsPermission' ? (
              <Button size="sm" variant="outline" onPress={() => void device.request()}>
                <Text>Allow</Text>
              </Button>
            ) : null}
          </View>
        ) : null}

        {nothing && query.trim() ? (
          <Text className="px-4 py-3 text-xs text-muted-foreground">
            Nobody matches. Use “Someone else” to type their details.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="border-t border-border bg-muted/40 px-4 pb-1.5 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      role="heading"
    >
      {children}
    </Text>
  );
}

function PersonRow({
  initials: init,
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  initials?: string;
  icon?: typeof UserPlus;
  title: string;
  subtitle?: string;
  badge?: string;
  onPress(): void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        'flex-row items-center gap-3 px-4 py-2.5 active:bg-accent',
        Platform.select({ web: 'hover:bg-accent/60' })
      )}
    >
      <View className="size-9 items-center justify-center rounded-full bg-muted">
        {icon ? (
          <Icon as={icon} size={16} className="text-foreground" />
        ) : (
          <Text className="text-xs font-semibold text-muted-foreground">{init}</Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <Badge variant="secondary">
          <Text>{badge}</Text>
        </Badge>
      ) : null}
    </Pressable>
  );
}

function SelectedBorrower({ borrower, onClear }: { borrower: Borrower; onClear(): void }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-primary bg-accent/50 p-3">
      <View className="size-10 items-center justify-center rounded-full bg-primary">
        <Text className="text-sm font-semibold text-primary-foreground">
          {initials(borrower.name)}
        </Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-base font-semibold" numberOfLines={1}>
            {borrower.name}
          </Text>
          <Icon as={Check} size={14} className="text-emerald-600 dark:text-emerald-400" />
        </View>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {borrower.phone ? formatPhone(borrower.phone) : 'No number'}
          {borrower.uid ? ' · On LendShelf' : ''}
        </Text>
      </View>
      <Button variant="ghost" size="sm" onPress={onClear}>
        <Text>Change</Text>
      </Button>
    </View>
  );
}

function ManualBorrower({
  initialName,
  onCancel,
  onDone,
}: {
  initialName: string;
  onCancel(): void;
  onDone(b: Borrower): void;
}) {
  // A search for digits is more likely a number than a name.
  const startsWithDigits = /^[+\d\s()-]{5,}$/.test(initialName.trim());
  const [name, setName] = useState(startsWithDigits ? '' : initialName.trim());
  const [phone, setPhone] = useState(startsWithDigits ? initialName.trim() : '');
  const [error, setError] = useState<{ name?: string; phone?: string }>({});

  const submit = () => {
    const cleanName = name.replace(/\s+/g, ' ').trim();
    const e164 = phone.trim() ? normalisePhoneLenient(phone, deviceRegion()) : null;
    const next: typeof error = {};
    if (!cleanName) next.name = 'Enter their name.';
    else if (cleanName.length > 60) next.name = 'That name is too long.';
    if (phone.trim() && !e164)
      next.phone = 'That number doesn’t look right. Include the country code if it’s not local.';
    setError(next);
    if (next.name || next.phone) return;
    onDone({ name: cleanName, phone: e164, uid: null });
  };

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold">Someone else</Text>
        <Pressable
          onPress={onCancel}
          className="size-8 items-center justify-center rounded-full active:bg-accent"
          // 32 dp circle, 48 dp touch target (F8).
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to the list"
        >
          <Icon as={X} size={16} className="text-muted-foreground" />
        </Pressable>
      </View>
      <View className="gap-1.5">
        <Input
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError((e) => ({ ...e, name: undefined }));
          }}
          placeholder="Name"
          autoFocus={!name}
          autoCapitalize="words"
          maxLength={70}
          className={cn(error.name && 'border-destructive')}
          accessibilityLabel="Borrower name"
        />
        {error.name ? <Text className="text-xs text-destructive">{error.name}</Text> : null}
      </View>
      <View className="gap-1.5">
        <Input
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            setError((e) => ({ ...e, phone: undefined }));
          }}
          placeholder="Phone number (optional)"
          keyboardType="phone-pad"
          onSubmitEditing={submit}
          className={cn(error.phone && 'border-destructive')}
          accessibilityLabel="Borrower phone number"
        />
        {error.phone ? (
          <Text className="text-xs text-destructive">{error.phone}</Text>
        ) : (
          <Text className="text-xs text-muted-foreground">
            With a number you can message them on WhatsApp, and if they’re on LendShelf they’ll see
            the loan too.
          </Text>
        )}
      </View>
      <Button onPress={submit}>
        <Text>Use this person</Text>
      </Button>
    </View>
  );
}
