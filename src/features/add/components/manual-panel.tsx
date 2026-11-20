import * as ImagePicker from 'expo-image-picker';
import { Camera, ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { formatIsbn, normaliseIsbn } from '@/features/add/isbn';
import { parseAuthors } from '@/features/add/save';
import type { AddCandidate } from '@/features/add/types';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';

const MAX_TITLE = 300;
const MAX_COVER_BYTES = 5 * 1024 * 1024;

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
 * Creates a candidate; the Book itself is created when the copy is saved.
 */
export function ManualPanel({
  prefill,
  autoFocus,
  onContinue,
}: {
  prefill: ManualPrefill;
  /** Focus the title on mount (only when this tab is the one showing). */
  autoFocus?: boolean;
  onContinue(candidate: AddCandidate): void;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(prefill.title ?? '');
  const [authors, setAuthors] = useState('');
  const [isbn, setIsbn] = useState(prefill.isbn ? formatIsbn(prefill.isbn) : '');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [errors, setErrors] = useState<{ title?: string; isbn?: string }>({});

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
      setPhoto({ uri: asset.uri, mimeType: asset.mimeType ?? null });
    } catch (e) {
      toastError(e, 'Couldn’t open the photo picker.');
    }
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

    onContinue({
      key: `manual-${Date.now()}`,
      workId: null,
      title: cleanTitle,
      authors: parseAuthors(authors),
      coverUrl: photo?.uri ?? null,
      isCustom: true,
      isbn: cleanIsbn,
      language: null,
      newWork: { localCoverUri: photo?.uri ?? null, coverMimeType: photo?.mimeType ?? null },
    });
  };

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
        <Button size="lg" onPress={submit}>
          <Text>Continue</Text>
        </Button>
      </View>
    </View>
  );
}
