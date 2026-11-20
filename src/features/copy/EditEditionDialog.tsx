import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast, toastError } from '@/lib/toast';
import type { Item, ItemFormat, WithId } from '@/types/model';

import { FORMAT_OPTIONS, LANGUAGE_OPTIONS, languageName } from '@/features/copy/edition';
import { updateItemEdition } from '@/features/shared/mutations';

const NONE = '__none__';

/**
 * Edit a copy's format and language. Form state starts from the item when mounted:
 * give it a `key` that changes per opening so it resets.
 */
export function EditEditionDialog({
  item,
  open,
  onOpenChange,
}: {
  item: WithId<Item>;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const insets = useSafeAreaInsets();
  const [format, setFormat] = useState<ItemFormat | null>(item.format);
  const [language, setLanguage] = useState<string | null>(item.language);
  const [saving, setSaving] = useState(false);

  const languageOptions = useMemo(() => {
    const opts = [{ value: NONE, label: 'Not set' }, ...LANGUAGE_OPTIONS];
    if (item.language && !opts.some((o) => o.value === item.language)) {
      opts.splice(1, 0, {
        value: item.language,
        label: languageName(item.language) ?? item.language,
      });
    }
    return opts;
  }, [item.language]);
  const selectedLanguage =
    languageOptions.find((o) => o.value === (language ?? NONE)) ?? languageOptions[0]!;

  const save = async () => {
    setSaving(true);
    try {
      await updateItemEdition(item.id, { format, language });
      toast.success('Edition details saved');
      onOpenChange(false);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] max-w-full">
        <DialogHeader>
          <DialogTitle>Edition details</DialogTitle>
          <DialogDescription>Helps borrowers know which copy they’re getting.</DialogDescription>
        </DialogHeader>
        <View className="gap-2">
          <Label nativeID="format-label">Format</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={format ?? undefined}
            onValueChange={(v) => setFormat((v as ItemFormat | undefined) ?? null)}
            className="w-full"
            aria-labelledby="format-label"
          >
            {FORMAT_OPTIONS.map((o, i) => (
              <ToggleGroupItem
                key={o.value}
                value={o.value}
                aria-label={o.label}
                isFirst={i === 0}
                isLast={i === FORMAT_OPTIONS.length - 1}
                className="flex-1"
              >
                <Text>{o.label}</Text>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </View>
        <View className="gap-2">
          <Label nativeID="language-label">Language</Label>
          <Select
            value={selectedLanguage}
            onValueChange={(opt) => opt && setLanguage(opt.value === NONE ? null : opt.value)}
          >
            <SelectTrigger className="w-full" aria-labelledby="language-label">
              <SelectValue placeholder="Choose a language" />
            </SelectTrigger>
            <SelectContent
              insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}
              className="w-72"
            >
              <SelectGroup>
                {languageOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} label={o.label}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </View>
        <DialogFooter>
          <Button variant="outline" onPress={() => onOpenChange(false)} disabled={saving}>
            <Text>Cancel</Text>
          </Button>
          <Button onPress={save} disabled={saving}>
            <Text>{saving ? 'Saving…' : 'Save'}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
