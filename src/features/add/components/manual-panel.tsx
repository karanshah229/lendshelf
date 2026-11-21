import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, PenLine, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ResultRow } from '@/features/add/components/search-panel';
import { formatIsbn, normaliseIsbn } from '@/features/add/isbn';
import { findCatalogueMatches, type OlSearchResult } from '@/features/add/open-library';
import { coverContentType, parseAuthors, UNSUPPORTED_COVER_MESSAGE } from '@/features/add/save';
import type { AddCandidate } from '@/features/add/types';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

const MAX_TITLE = 300;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
/** Don't hold up saving for a slow catalogue. */
const CHECK_TIMEOUT_MS = 6000;

export interface ManualPrefill {
  title?: string;
  isbn?: string;
}

interface Photo {
  uri: string;
  mimeType: string | null;
}

/**
 * A book typed in by hand: title, authors, optional ISBN and cover photo.
 * Creates a candidate; the Book itself is created when the copy is saved. Before that, the
 * catalogue is checked for the same title and any matches are offered ("Is it one of these?"),
 * because hand-entered books are private to whoever typed them in (E8, C13).
 */
export function ManualPanel({
  prefill,
  autoFocus,
  ownedWorkIds,
  resolvingKey,
  onPickWork,
  onContinue,
  onDraftChange,
}: {
  prefill: ManualPrefill;
  /** Whether anything has been typed or picked, so leaving can ask first (F2, QA B17). */
  onDraftChange?(hasDraft: boolean): void;
  /** Focus the title on mount (only when this tab is the one showing). */
  autoFocus?: boolean;
  /** workIds I already own a copy of ("In your books" on a match). */
  ownedWorkIds: ReadonlySet<string>;
  /** Key of the catalogue result being resolved, to show a spinner. */
  resolvingKey: string | null;
  onPickWork(result: OlSearchResult): void;
  onContinue(candidate: AddCandidate): void;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(prefill.title ?? '');
  const [authors, setAuthors] = useState('');
  const [isbn, setIsbn] = useState(prefill.isbn ? formatIsbn(prefill.isbn) : '');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const hasDraft = !!(title.trim() || authors.trim() || isbn.trim() || photo);
  useEffect(() => {
    onDraftChange?.(hasDraft);
  }, [hasDraft, onDraftChange]);
  const [errors, setErrors] = useState<{ title?: string; isbn?: string }>({});
  const [checking, setChecking] = useState(false);
  const [review, setReview] = useState<{
    candidate: AddCandidate;
    matches: OlSearchResult[];
  } | null>(null);
  const check = useRef<AbortController | null>(null);
  useEffect(() => () => check.current?.abort(), []);

  const pick = async (source: 'camera' | 'library') => {
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [2, 3],
        quality: 0.6,
      };
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          toast.error('Allow camera access in Settings to take a cover photo.');
          return;
        }
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      const asset = res.canceled ? null : res.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > MAX_COVER_BYTES) {
        toast.error('That photo is too large. Pick one under 5 MB.');
        return;
      }
      const mimeType = coverContentType(asset.mimeType, asset.uri);
      if (!mimeType) {
        toast.error(UNSUPPORTED_COVER_MESSAGE);
        return;
      }
      setPhoto({ uri: asset.uri, mimeType });
    } catch (e) {
      toastError(e, 'Couldn’t open the photo picker.');
    }
  };

  const checkCatalogue = async (candidate: AddCandidate) => {
    check.current?.abort();
    const controller = new AbortController();
    check.current = controller;
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    setChecking(true);
    let matches: OlSearchResult[] = [];
    try {
      matches = await findCatalogueMatches(candidate, { signal: controller.signal });
    } catch {
      // Offline, slow or failed: the check is only a helper, so carry on with what was typed.
    } finally {
      clearTimeout(timer);
    }
    if (check.current !== controller) return;
    check.current = null;
    setChecking(false);
    if (matches.length) setReview({ candidate, matches });
    else onContinue(candidate);
  };

  const submit = () => {
    const cleanTitle = title.replace(/\s+/g, ' ').trim();
    const cleanIsbn = isbn.trim() ? normaliseIsbn(isbn) : null;
    const next: typeof errors = {};
    if (!cleanTitle) next.title = 'Enter the book’s title.';
    else if (cleanTitle.length > MAX_TITLE) next.title = 'That title is too long.';
    if (isbn.trim() && !cleanIsbn) next.isbn = 'That isn’t a valid ISBN. Leave it empty if unsure.';
    setErrors(next);
    if (next.title || next.isbn) return;

    const candidate: AddCandidate = {
      key: `manual-${Date.now()}`,
      workId: null,
      title: cleanTitle,
      authors: parseAuthors(authors),
      coverUrl: photo?.uri ?? null,
      isCustom: true,
      isbn: cleanIsbn,
      language: null,
      newWork: { localCoverUri: photo?.uri ?? null, coverMimeType: photo?.mimeType ?? null },
    };
    void checkCatalogue(candidate);
  };

  if (review) {
    return (
      <CatalogueMatches
        typedTitle={review.candidate.title}
        matches={review.matches}
        ownedWorkIds={ownedWorkIds}
        resolvingKey={resolvingKey}
        onPick={onPickWork}
        onKeepMine={() => onContinue(review.candidate)}
        onEdit={() => setReview(null)}
      />
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row gap-4">
          <View className="items-center gap-2">
            <Pressable
              onPress={() => void pick('library')}
              accessibilityRole="button"
              accessibilityLabel={photo ? 'Change cover photo' : 'Add a cover photo'}
              className="active:opacity-80"
            >
              {photo ? (
                <BookCover uri={photo.uri} title={title} size="md" />
              ) : (
                <View className="aspect-[2/3] w-24 items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-muted/50">
                  <Icon as={ImagePlus} size={22} className="text-muted-foreground" />
                  <Text className="text-center text-[11px] font-medium text-muted-foreground">
                    Cover photo
                  </Text>
                </View>
              )}
            </Pressable>
            <View className="flex-row gap-1">
              {Platform.OS !== 'web' ? (
                <Pressable
                  onPress={() => void pick('camera')}
                  className="size-8 items-center justify-center rounded-full border border-border active:bg-accent"
                  accessibilityRole="button"
                  accessibilityLabel="Take a cover photo"
                  hitSlop={8}
                >
                  <Icon as={Camera} size={15} className="text-foreground" />
                </Pressable>
              ) : null}
              {photo ? (
                <Pressable
                  onPress={() => setPhoto(null)}
                  className="size-8 items-center justify-center rounded-full border border-border active:bg-accent"
                  accessibilityRole="button"
                  accessibilityLabel="Remove cover photo"
                  hitSlop={8}
                >
                  <Icon as={Trash2} size={15} className="text-muted-foreground" />
                </Pressable>
              ) : null}
            </View>
          </View>

          <View className="flex-1 gap-1.5">
            <Label nativeID="manual-title">Title</Label>
            <Input
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
              }}
              placeholder="The book’s title"
              autoFocus={autoFocus && !prefill.title}
              autoCapitalize="words"
              maxLength={MAX_TITLE}
              aria-labelledby="manual-title"
              className={cn(errors.title && 'border-destructive')}
            />
            {errors.title ? (
              <Text className="text-xs text-destructive">{errors.title}</Text>
            ) : (
              <Text className="text-xs leading-4 text-muted-foreground">
                As printed on the cover. Tap the box to add a photo of it.
              </Text>
            )}
          </View>
        </View>

        <View className="gap-1.5">
          <Label nativeID="manual-authors">Author</Label>
          <Input
            value={authors}
            onChangeText={setAuthors}
            placeholder="e.g. R. K. Narayan"
            autoCapitalize="words"
            aria-labelledby="manual-authors"
          />
          <Text className="text-xs text-muted-foreground">
            Separate several authors with commas.
          </Text>
        </View>

        <View className="gap-1.5">
          <Label nativeID="manual-isbn">
            ISBN <Text className="text-sm font-normal text-muted-foreground">(optional)</Text>
          </Label>
          <Input
            value={isbn}
            onChangeText={(t) => {
              setIsbn(t);
              if (errors.isbn) setErrors((e) => ({ ...e, isbn: undefined }));
            }}
            placeholder="10 or 13 digits"
            keyboardType="number-pad"
            aria-labelledby="manual-isbn"
            className={cn(errors.isbn && 'border-destructive')}
          />
          {errors.isbn ? <Text className="text-xs text-destructive">{errors.isbn}</Text> : null}
        </View>
      </ScrollView>

      <View
        className="border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button size="lg" onPress={submit} disabled={checking}>
          {checking ? <ActivityIndicator size="small" color="#888" /> : null}
          <Text>{checking ? 'Checking the catalogue…' : 'Continue'}</Text>
        </Button>
      </View>
    </View>
  );
}

/** "Is it one of these?": catalogue records matching a hand-entered title. */
function CatalogueMatches({
  typedTitle,
  matches,
  ownedWorkIds,
  resolvingKey,
  onPick,
  onKeepMine,
  onEdit,
}: {
  typedTitle: string;
  matches: OlSearchResult[];
  ownedWorkIds: ReadonlySet<string>;
  resolvingKey: string | null;
  onPick(result: OlSearchResult): void;
  onKeepMine(): void;
  onEdit(): void;
}) {
  const insets = useSafeAreaInsets();
  const busy = resolvingKey !== null;
  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-2 pb-8">
        <View className="gap-1 px-2">
          <Text className="text-lg font-semibold" role="heading">
            Is it one of these?
          </Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            Pick the catalogue’s record so friends can find your copy, with its cover and
            description.
          </Text>
        </View>
        <View className="gap-0.5">
          {matches.map((r) => (
            <ResultRow
              key={r.workKey}
              result={r}
              owned={ownedWorkIds.has(`ol_${r.workKey}`)}
              resolving={resolvingKey === r.workKey}
              disabled={busy}
              onPress={() => onPick(r)}
            />
          ))}
        </View>
      </ScrollView>
      <View
        className="gap-2 border-t border-border bg-background px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button size="lg" variant="outline" onPress={onKeepMine} disabled={busy}>
          <Icon as={PenLine} size={16} />
          {/* Wraps to a second line at large font sizes instead of cutting the choice off (F8). */}
          <Text numberOfLines={2}>No, add “{typedTitle}” as I typed it</Text>
        </Button>
        <Button variant="ghost" onPress={onEdit} disabled={busy}>
          <Text>Back to edit</Text>
        </Button>
      </View>
    </View>
  );
}
