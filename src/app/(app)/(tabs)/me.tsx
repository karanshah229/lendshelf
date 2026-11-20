import { router, type Href } from 'expo-router';
import {
  ChevronRight,
  Download,
  FolderCog,
  Heart,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupIcon, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuth, useMyProfile } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { timeAgo } from '@/lib/dates';
import { signOut } from '@/lib/firebase';
import { formatPhone } from '@/lib/phone';
import { syncContactsNow } from '@/lib/sync-contacts';
import { toast, toastError } from '@/lib/toast';
import { useContactsStore } from '@/stores/contacts';
import type { ThemePreference } from '@/stores/theme';

function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-1 pb-2 pt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </Text>
  );
}

function Row({
  icon,
  label,
  detail,
  href,
  onPress,
  right,
}: {
  icon: LucideIcon;
  label: string;
  detail?: string;
  href?: Href;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const press = onPress ?? (href ? () => router.push(href) : undefined);
  return (
    <Pressable
      onPress={press}
      disabled={!press}
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-accent"
      accessibilityRole={press ? 'button' : undefined}
    >
      <Icon as={icon} size={18} className="text-muted-foreground" />
      <View className="flex-1">
        <Text className="text-sm font-medium">{label}</Text>
        {detail ? <Text className="text-xs text-muted-foreground">{detail}</Text> : null}
      </View>
      {right ??
        (press ? <Icon as={ChevronRight} size={16} className="text-muted-foreground" /> : null)}
    </Pressable>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export default function MeScreen() {
  const { user } = useAuth();
  const { profile } = useMyProfile();
  const { preference, setPreference } = useColorScheme();
  const syncing = useContactsStore((s) => s.syncing);
  const linkCount = useContactsStore((s) => s.linkCount);
  const lastSyncedAt = useContactsStore((s) => s.lastSyncedAt);
  const [signingOut, setSigningOut] = useState(false);

  const resync = async () => {
    try {
      const res = await syncContactsNow();
      if (res.status !== 'synced') {
        router.push('/contacts');
        return;
      }
      toast.success(`Contacts synced · ${res.links.length} on LendShelf`);
    } catch (e) {
      toastError(e, 'Couldn’t sync contacts.');
    }
  };

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      toastError(e);
      setSigningOut(false);
    }
  };

  return (
    <Screen safeBottom={false} header={<ScreenHeader large title="Me" />}>
      <Card className="flex-row items-center gap-4 px-4 py-4">
        <Avatar alt={profile?.name ?? 'You'} className="size-14">
          <AvatarFallback>
            <Text className="text-lg font-semibold">{initials(profile?.name)}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1 gap-0.5">
          <Text className="text-lg font-semibold" numberOfLines={1}>
            {profile?.name ?? '—'}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {user?.phoneNumber ? formatPhone(user.phoneNumber) : ''}
          </Text>
          {profile?.pickupNote ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              Pickup: {profile.pickupNote}
            </Text>
          ) : null}
        </View>
      </Card>

      <SectionLabel>Contacts</SectionLabel>
      <Card className="gap-0 py-0">
        <Row
          icon={Users}
          label="Contacts"
          detail={
            lastSyncedAt
              ? `${linkCount} ${linkCount === 1 ? 'person' : 'people'} on LendShelf · synced ${timeAgo(lastSyncedAt)}`
              : 'Not synced yet'
          }
          href="/contacts"
        />
        <Separator />
        <Row
          icon={RefreshCw}
          label={syncing ? 'Syncing…' : 'Sync now'}
          onPress={syncing ? undefined : resync}
          right={syncing ? <ActivityIndicator size="small" /> : null}
        />
      </Card>

      <SectionLabel>Library</SectionLabel>
      <Card className="gap-0 py-0">
        <Row
          icon={FolderCog}
          label="Collections"
          detail="Create, rename, public or private"
          href="/shelves"
        />
        <Separator />
        <Row
          icon={Heart}
          label="Wishlist"
          detail="Books you’ll be notified about"
          href="/wishlist"
        />
        <Separator />
        <Row icon={Download} label="Export" detail="CSV or JSON (coming soon)" />
      </Card>

      <SectionLabel>Appearance</SectionLabel>
      <Card className="px-4 py-4">
        <ToggleGroup
          type="single"
          variant="outline"
          value={preference}
          onValueChange={(v) => v && setPreference(v as ThemePreference)}
          className="w-full"
        >
          {THEME_OPTIONS.map((o, i) => (
            <ToggleGroupItem
              key={o.value}
              value={o.value}
              aria-label={o.label}
              isFirst={i === 0}
              isLast={i === THEME_OPTIONS.length - 1}
              className="flex-1 flex-row gap-2"
            >
              <ToggleGroupIcon as={o.icon} size={16} />
              <Text>{o.label}</Text>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Card>

      <View className="mt-8 gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={signingOut}>
              <Icon as={LogOut} size={16} />
              <Text>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out?</AlertDialogTitle>
              <AlertDialogDescription>
                Your books and loans stay safe. Sign in again with the same number to get back to
                them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                <Text>Cancel</Text>
              </AlertDialogCancel>
              <AlertDialogAction onPress={doSignOut}>
                <Text>Sign out</Text>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Text className="text-center text-xs text-muted-foreground">LendShelf 0.1.0</Text>
      </View>
    </Screen>
  );
}
