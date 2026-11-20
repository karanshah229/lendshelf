import {
  BookOpen,
  Contact,
  Eye,
  Phone,
  Share2,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

const UPDATED = '21 November 2026';

function Section({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3 px-4 py-4">
      <View className="flex-row items-center gap-3">
        <View className="size-8 items-center justify-center rounded-md bg-muted">
          <Icon as={icon} size={16} className="text-muted-foreground" />
        </View>
        <Text className="flex-1 text-base font-semibold">{title}</Text>
      </View>
      <View className="gap-2">{children}</View>
    </Card>
  );
}

function P({ children }: { children: ReactNode }) {
  return <Text className="text-sm leading-6 text-muted-foreground">{children}</Text>;
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <View className="flex-row gap-2 pl-1">
      <Text className="text-sm leading-6 text-muted-foreground">•</Text>
      <Text className="flex-1 text-sm leading-6 text-muted-foreground">{children}</Text>
    </View>
  );
}

/** Plain-English privacy policy (matches SPEC §1 and §3). */
export default function PrivacyScreen() {
  return (
    <Screen header={<ScreenHeader title="Privacy policy" />} className="gap-4">
      <View className="gap-2 px-1">
        <Text className="text-2xl font-bold tracking-tight">Your data on LendShelf</Text>
        <P>
          LendShelf is a private lending library for friends and family. We keep only what the app
          needs to work, we don’t sell or share it, and there are no ads or trackers. Last updated{' '}
          {UPDATED}.
        </P>
      </View>

      <Section icon={Phone} title="Your phone number and name">
        <P>
          You sign in with your phone number and an SMS code. We store your number so people who
          have it saved can find you, plus the name and optional pickup note you enter.
        </P>
        <P>
          Your number is shown only to people you lend to or borrow from, so you can talk on
          WhatsApp.
        </P>
      </Section>

      <Section icon={Contact} title="Your contacts">
        <Bullet>
          When you sync, the app sends the phone numbers in your contacts to our server to check
          which of them use LendShelf. Names and other details never leave your phone.
        </Bullet>
        <Bullet>
          We keep only the matches (people already on LendShelf). All other numbers are thrown away
          straight after the check; your address book is never stored.
        </Bullet>
        <Bullet>Matching is one-way: people don’t learn that you saved their number.</Bullet>
      </Section>

      <Section icon={BookOpen} title="Books, loans and reviews">
        <Bullet>
          Your books and collections, including which ones are public, private or hidden.
        </Bullet>
        <Bullet>
          Loans: who has which book, due dates and any message sent with a borrow request. Only you
          and the other person see who has a book; your contacts just see “Lent out”.
        </Bullet>
        <Bullet>
          Reviews and star ratings, visible to you and people who have your number saved.
        </Bullet>
        <Bullet>Your wishlist and “tell me when it’s back” alerts, visible only to you.</Bullet>
        <Bullet>A device token for push notifications, if you allow them.</Bullet>
      </Section>

      <Section icon={Eye} title="Who can see what">
        <P>
          People who have your number saved see the books on your public collections, your name and
          pickup note. Private collections and hidden books are visible only to you.
        </P>
      </Section>

      <Section icon={Share2} title="Services we use">
        <P>
          Data is stored with Google Firebase. Book details and covers come from Open Library and
          Google Books (we send them an ISBN or search text, never your personal details). Push
          notifications go through Expo’s push service. Chats happen in WhatsApp, under WhatsApp’s
          own policy.
        </P>
      </Section>

      <Section icon={Trash2} title="Export and deletion">
        <P>
          You can export your books, loans and reviews as CSV or JSON from the Me tab at any time.
        </P>
        <P>
          Deleting your account (Me → Delete account) removes your profile, number, books,
          collections, reviews, wishlist and contact matches straight away. People who lent you a
          book keep your name and number on that loan so they can get it back; open loans you owned
          are closed.
        </P>
      </Section>
    </Screen>
  );
}
