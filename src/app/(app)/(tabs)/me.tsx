import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import {
  Download,
  FolderCog,
  Heart,
  Info,
  LogOut,
  MapPin,
  Monitor,
  Moon,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sun,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

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
import { newPeopleLine } from '@/features/contacts/resync';
import { openContactsSettings } from '@/features/contacts/use-auto-resync';
import { useManualSync } from '@/features/contacts/use-manual-sync';
import { ExportDialog } from '@/features/export/export-dialog';
import { meContactsDetail } from '@/features/first-run/first-run';
import { useInvite } from '@/features/invite/use-invite';
import { signOutAndCleanUp } from '@/features/me/account';
import { DeleteAccountButton } from '@/features/me/delete-account-dialog';
import { EditProfileDialog } from '@/features/me/edit-profile-dialog';
import { NotificationsSection } from '@/features/me/notifications-section';
import { Row, SectionLabel } from '@/features/me/rows';
import { initials } from '@/features/shared/people';
import { useAuth, useMyProfile } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { HAS_ADDRESS_BOOK } from '@/lib/contacts';
import { timeAgo } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { toast, toastError } from '@/lib/toast';
import { useContactsStore } from '@/stores/contacts';
import type { ThemePreference } from '@/stores/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0';
// Added by this change; typed routes regenerate when the dev server runs.
const PRIVACY_HREF = '/privacy' as Href;

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
  const skippedRemovals = useContactsStore((s) => s.skippedRemovals);
  const permission = useContactsStore((s) => s.permission);
  const manualCount = useContactsStore((s) => s.manualContacts.length);
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** The last manual sync's result, inline under Sync now (E13: "2 new: Zoya, Kabir"). */
  const [syncLine, setSyncLine] = useState<string | null>(null);
  const manualSync = useManualSync();
  const invite = useInvite();

  const resync = async () => {
    setSyncLine(null);
    const res = await manualSync.sync();
    if (res.status === 'error') {
      setSyncLine(res.message);
      toast.error(res.message);
      return;
    }
    if (res.status !== 'synced') {
      router.push('/contacts');
      return;
    }
    // Nothing was removed; the Sync anyway sheet asks what to do and reports the result.
    if (res.skippedRemovals > 0) return;
    const n = res.links.length;
    const saved = useContactsStore.getState().nameByPhone;
    const fresh = newPeopleLine(
      res.newLinks.map((l) => saved[l.ownerPhone] ?? l.name ?? formatPhone(l.ownerPhone))
    );
    setSyncLine(fresh ?? `No one new · ${n} ${n === 1 ? 'person' : 'people'} on LendShelf`);
    toast.success(`Contacts synced · ${n} ${n === 1 ? 'person' : 'people'} on LendShelf`);
  };

  const contactsOff = HAS_ADDRESS_BOOK && permission === 'denied';
  const contactsDetail = meContactsDetail({
    hasAddressBook: HAS_ADDRESS_BOOK,
    permission,
    linkCount,
    checkedAgo: lastSyncedAt ? timeAgo(lastSyncedAt) : null,
    skippedRemovals,
    manualCount,
  });

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutAndCleanUp();
    } catch (e) {
      toastError(e);
      setSigningOut(false);
    }
  };

  return (
    <Screen safeBottom={false} header={<ScreenHeader large title="Me" />}>
      {/* Profile */}
      <Card className="gap-0 py-0">
        <View className="flex-row items-center gap-4 px-4 py-4">
          <Avatar alt={profile?.name ?? 'You'} className="size-14">
            <AvatarFallback>
              <Text className="text-lg font-semibold">{initials(profile?.name)}</Text>
            </AvatarFallback>
          </Avatar>
          <View className="flex-1 gap-0.5">
            <Text className="text-lg font-semibold" numberOfLines={1}>
              {profile?.name ?? '—'}
            </Text>
            {user?.phoneNumber ? (
              <View className="flex-row items-center gap-1.5">
                <Icon as={Phone} size={12} className="text-muted-foreground" />
                <Text className="text-sm text-muted-foreground">
                  {formatPhone(user.phoneNumber)}
                </Text>
              </View>
            ) : null}
          </View>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setEditing(true)}
            disabled={!profile}
            accessibilityLabel="Edit profile"
          >
            <Icon as={Pencil} size={14} />
            <Text>Edit</Text>
          </Button>
        </View>
        <Separator />
        <View className="flex-row items-start gap-3 px-4 py-3">
          <Icon as={MapPin} size={16} className="mt-0.5 text-muted-foreground" />
          <View className="flex-1 gap-0.5">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pickup note
            </Text>
            {profile?.pickupNote ? (
              <Text className="text-sm leading-5">{profile.pickupNote}</Text>
            ) : (
              // A 48 dp touch target around the one-line text (F8).
              <Pressable
                onPress={() => setEditing(true)}
                accessibilityRole="button"
                hitSlop={{ top: 14, bottom: 14 }}
                className="self-start active:opacity-70"
              >
                <Text className="text-sm text-muted-foreground">
                  Add where and when people can pick up books
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Card>

      {/* Contacts */}
      <SectionLabel>Contacts</SectionLabel>
      <Card className="gap-0 py-0">
        <Row
          icon={UserPlus}
          label="Invite friends"
          detail="Share LendShelf on WhatsApp, with your number to save"
          onPress={() => void invite()}
        />
        <Separator />
        <Row
          icon={Users}
          label={HAS_ADDRESS_BOOK ? 'Contacts' : 'Your contacts'}
          detail={contactsDetail}
          // Contacts off: "Off · Turn on" opens Settings (E2a iii).
          {...(contactsOff ? { onPress: openContactsSettings } : { href: '/contacts' as const })}
        />
        <Separator />
        <Row
          icon={RefreshCw}
          label={syncing ? 'Syncing…' : 'Sync now'}
          detail={
            syncLine ??
            (HAS_ADDRESS_BOOK
              ? 'Only numbers are checked; your address book is never stored'
              : 'Web has no address book: add numbers under Your contacts')
          }
          onPress={syncing ? undefined : resync}
          right={syncing ? <ActivityIndicator size="small" /> : undefined}
        />
      </Card>
      {manualSync.element}

      {/* Library */}
      <SectionLabel>Library</SectionLabel>
      <Card className="gap-0 py-0">
        <Row
          icon={Heart}
          label="Wishlist"
          detail="Books you’ll be told about when a friend adds them"
          href="/wishlist"
        />
        <Separator />
        <Row
          icon={FolderCog}
          label="Collections"
          detail="Create, rename, public or private"
          href="/shelves"
        />
        <Separator />
        <Row
          icon={Download}
          label="Export"
          detail={Platform.OS === 'web' ? 'Download CSV or JSON' : 'Share a CSV or JSON file'}
          onPress={() => setExporting(true)}
        />
      </Card>

      <NotificationsSection />

      {/* Appearance */}
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

      {/* About */}
      <SectionLabel>About</SectionLabel>
      <Card className="gap-0 py-0">
        <Row
          icon={ShieldCheck}
          label="Privacy policy"
          detail="What we store and how to delete it"
          href={PRIVACY_HREF}
        />
        <Separator />
        <Row
          icon={Info}
          label="LendShelf"
          detail="A private lending library for friends and family"
          right={<Text className="text-sm text-muted-foreground">v{APP_VERSION}</Text>}
        />
      </Card>

      <View className="mt-8 gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={signingOut}>
              {signingOut ? <ActivityIndicator size="small" /> : <Icon as={LogOut} size={16} />}
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
        <DeleteAccountButton />
      </View>

      <EditProfileDialog
        open={editing}
        onOpenChange={setEditing}
        name={profile?.name ?? ''}
        pickupNote={profile?.pickupNote ?? null}
      />
      <ExportDialog open={exporting} onOpenChange={setExporting} />
    </Screen>
  );
}
