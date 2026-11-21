import { router } from 'expo-router';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  HandHeart,
  Lock,
  Plus,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { formatIsbn } from '@/features/add/isbn';
import { LANGUAGES, languageName, normaliseLanguageInput } from '@/features/add/languages';
import { addCopies, type CopySettings } from '@/features/add/save';
import type { AddCandidate } from '@/features/add/types';
import { VISIBILITY_COPY } from '@/features/copy/visibility-copy';
import { Chip } from '@/features/library/components/chip';
import { useUid } from '@/hooks/use-auth';
import { useMyShelves } from '@/hooks/use-shelves';
import { toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { defaultShelfId, type ItemFormat, type Visibility } from '@/types/model';

/**
 * Collection and visibility are remembered for the next add in this session. Format and
 * language start unset for every book (language: as detected by the catalogue, if it was).
 */
let remembered: Pick<CopySettings, 'shelfId' | 'visibility'> | null = null;

export interface SavedResult {
  count: number;
  shelfName: string;
  titles: string[];
  isbns: string[];
}

export interface ConfirmStepProps {
  candidates: AddCandidate[];
  /** workIds I already own a copy of (duplicate warning, not blocking). */
  ownedWorkIds: ReadonlySet<string>;
  /** Preferred collection (e.g. the one open in My books). */
  preferredShelfId?: string | null;
  onRemove?(key: string): void;
  onSaved(result: SavedResult): void;
}

const VISIBILITY: { value: Visibility; title: string; body: string; icon: LucideIcon }[] = (
  [
    ['lendable', HandHeart],
    ['visible', Eye],
    ['hidden', EyeOff],
  ] as const
).map(([value, icon]) => ({
  value,
  title: VISIBILITY_COPY[value].label,
  body: VISIBILITY_COPY[value].help,
  icon,
}));

const FORMATS: { value: ItemFormat; label: string }[] = [
  { value: 'paperback', label: 'Paperback' },
  { value: 'hardcover', label: 'Hardcover' },
  { value: 'other', label: 'Other' },
];

/** Collection, visibility, format and language for one or many new copies, then save. */
export function ConfirmStep({
  candidates,
  ownedWorkIds,
  preferredShelfId,
  onRemove,
  onSaved,
}: ConfirmStepProps) {
  const uid = useUid();
  const insets = useSafeAreaInsets();
  const { shelves, loading: shelvesLoading } = useMyShelves();
  const batch = candidates.length > 1;
  const single = candidates.length === 1 ? candidates[0] : undefined;

  const [shelfChoice, setShelfChoice] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>(remembered?.visibility ?? 'lendable');
  const [format, setFormat] = useState<ItemFormat | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [language, setLanguage] = useState<string | 'auto' | null>(
    batch ? 'auto' : (single?.language ?? null)
  );
  const [otherLanguage, setOtherLanguage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const shelf = useMemo(() => {
    const ids = [shelfChoice, preferredShelfId, remembered?.shelfId, defaultShelfId(uid)];
    for (const id of ids) {
      const s = id ? shelves.find((x) => x.id === id) : undefined;
      if (s) return s;
    }
    return shelves[0] ?? null;
  }, [shelfChoice, preferredShelfId, shelves, uid]);

  const duplicates = candidates.filter((c) => c.workId && ownedWorkIds.has(c.workId));

  const save = async () => {
    if (!shelf || !candidates.length) return;
    const settings: CopySettings = { shelfId: shelf.id, visibility, format, language };
    setSaving(true);
    try {
      await addCopies({ uid, shelf, candidates, settings });
      remembered = { shelfId: shelf.id, visibility };
      onSaved({
        count: candidates.length,
        shelfName: shelf.name,
        titles: candidates.map((c) => c.title),
        isbns: candidates.map((c) => c.isbn).filter((x): x is string => !!x),
      });
    } catch (e) {
      toastError(e, 'Couldn’t add the book. Please try again.');
      setSaving(false);
    }
  };

  // Language chips: the current value first if it isn't a listed one.
  const languageChips = useMemo(() => {
    const listed = LANGUAGES.map((l) => ({ code: l.code, name: l.name }));
    const detected = single?.language;
    if (detected && !listed.some((l) => l.code === detected)) {
      listed.unshift({ code: detected, name: languageName(detected) ?? detected });
    }
    if (
      typeof language === 'string' &&
      language !== 'auto' &&
      !listed.some((l) => l.code === language)
    ) {
      listed.unshift({ code: language, name: languageName(language) ?? language });
    }
    return listed;
  }, [single?.language, language]);

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4 pb-8 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        {single ? (
          <View className="flex-row gap-4">
            <BookCover uri={single.coverUrl} title={single.title} size="md" />
            <View className="flex-1 justify-center gap-1">
              <Text className="text-xl font-bold leading-6 tracking-tight" numberOfLines={3}>
                {single.title}
              </Text>
              {single.authors.length ? (
                <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                  {single.authors.join(', ')}
                </Text>
              ) : null}
              {single.isbn ? (
                <Text className="text-xs text-muted-foreground">
                  ISBN {formatIsbn(single.isbn)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <Text className="text-sm font-semibold">{candidates.length} books</Text>
            <View className="overflow-hidden rounded-xl border border-border bg-card">
              {candidates.map((c, i) => (
                <View key={c.key}>
                  {i > 0 ? <Separator /> : null}
                  <View className="flex-row items-center gap-3 p-2">
                    <BookCover uri={c.coverUrl} title={c.title} size="xs" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {c.title}
                      </Text>
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {c.authors.join(', ')}
                      </Text>
                      {c.workId && ownedWorkIds.has(c.workId) ? (
                        <Text className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          You already have a copy
                        </Text>
                      ) : null}
                    </View>
                    {onRemove ? (
                      <Pressable
                        onPress={() => onRemove(c.key)}
                        disabled={saving}
                        className="size-8 items-center justify-center rounded-full active:bg-accent"
                        // 32 dp circle, 48 dp touch target (F8).
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Don’t add ${c.title}`}
                      >
                        <Icon as={X} size={16} className="text-muted-foreground" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {single && duplicates.length ? (
          <View className="flex-row gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <Icon as={TriangleAlert} size={18} className="text-amber-600 dark:text-amber-400" />
            <Text className="flex-1 text-sm leading-5 text-amber-800 dark:text-amber-200">
              You already have a copy of this book. Adding it again creates a second copy.
            </Text>
          </View>
        ) : null}

        {/* E8: the collection is only asked when there's more than one (QA friction). */}
        {shelvesLoading || shelves.length > 1 ? (
          <Section title="Collection">
            {shelvesLoading ? (
              <ActivityIndicator className="self-start" />
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {shelves.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    icon={s.isPublic ? undefined : Lock}
                    selected={shelf?.id === s.id}
                    onPress={() => setShelfChoice(s.id)}
                  />
                ))}
                <Chip
                  label="New"
                  icon={Plus}
                  className="border-dashed"
                  onPress={() => router.push('/shelves')}
                  accessibilityLabel="Create a collection"
                />
              </View>
            )}
            {shelf && !shelf.isPublic ? (
              <View className="flex-row items-center gap-2">
                <Icon as={Lock} size={13} className="text-muted-foreground" />
                <Text className="flex-1 text-xs text-muted-foreground">
                  {shelf.name} is private, so only you will see{' '}
                  {batch ? 'these books' : 'this book'}.
                </Text>
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section title="Who can see it">
          <View className="gap-2">
            {VISIBILITY.map((v) => {
              const selected = visibility === v.value;
              return (
                <Pressable
                  key={v.value}
                  onPress={() => setVisibility(v.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  className={cn(
                    'flex-row items-center gap-3 rounded-lg border p-3',
                    selected ? 'border-primary bg-accent/60' : 'border-border active:bg-accent'
                  )}
                >
                  <Icon
                    as={v.icon}
                    size={18}
                    className={selected ? 'text-foreground' : 'text-muted-foreground'}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{v.title}</Text>
                    <Text className="text-xs text-muted-foreground">
                      {/* A private collection hides it whatever is picked here (QA-ANDROID polish). */}
                      {shelf && !shelf.isPublic && v.value !== 'hidden'
                        ? 'Applies if you move it to a shared collection.'
                        : v.body}
                    </Text>
                  </View>
                  <View
                    className={cn(
                      'size-4 items-center justify-center rounded-full border',
                      selected ? 'border-primary' : 'border-input'
                    )}
                  >
                    {selected ? <View className="size-2 rounded-full bg-primary" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Pressable
          onPress={() => setShowDetails((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showDetails }}
          className="min-h-11 flex-row items-center gap-2"
        >
          <Icon
            as={showDetails ? ChevronUp : ChevronDown}
            size={16}
            className="text-muted-foreground"
          />
          <Text className="text-sm font-medium text-muted-foreground">
            {showDetails ? 'Fewer details' : 'Format and language (optional)'}
          </Text>
        </Pressable>
        {showDetails ? (
          <>
            <Section title="Format" hint="Optional">
              <View className="flex-row flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <Chip
                    key={f.value}
                    label={f.label}
                    selected={format === f.value}
                    onPress={() => setFormat(format === f.value ? null : f.value)}
                  />
                ))}
              </View>
            </Section>

            <Section title="Language" hint="Optional">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2"
                className="-mx-4"
                contentContainerStyle={{ paddingHorizontal: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {batch ? (
                  <Chip
                    label="As detected"
                    selected={language === 'auto'}
                    onPress={() => {
                      setLanguage('auto');
                      setOtherLanguage(null);
                    }}
                  />
                ) : null}
                {languageChips.map((l) => (
                  <Chip
                    key={l.code}
                    label={l.name}
                    selected={language === l.code && otherLanguage === null}
                    onPress={() => {
                      setOtherLanguage(null);
                      setLanguage(language === l.code ? (batch ? 'auto' : null) : l.code);
                    }}
                  />
                ))}
                <Chip
                  label="Other…"
                  selected={otherLanguage !== null}
                  onPress={() => setOtherLanguage(otherLanguage === null ? '' : null)}
                />
              </ScrollView>
              {otherLanguage !== null ? (
                <Input
                  value={otherLanguage}
                  onChangeText={(t) => {
                    setOtherLanguage(t);
                    setLanguage(normaliseLanguageInput(t) ?? (batch ? 'auto' : null));
                  }}
                  placeholder="e.g. Konkani"
                  maxLength={20}
                  autoFocus
                  autoCapitalize="words"
                />
              ) : null}
            </Section>
          </>
        ) : null}
      </ScrollView>

      <View
        className="border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button size="lg" disabled={!shelf || saving || !candidates.length} onPress={save}>
          {saving ? <ActivityIndicator size="small" color="#888" /> : null}
          <Text>
            {saving
              ? 'Adding…'
              : batch
                ? `Add ${candidates.length} books to ${shelf?.name ?? '…'}`
                : `Add to ${shelf?.name ?? '…'}`}
          </Text>
        </Button>
      </View>
    </View>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-sm font-semibold">{title}</Text>
        {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}
