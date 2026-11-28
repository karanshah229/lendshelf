import { Braces, ChevronRight, FileSpreadsheet, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { assembleExport, exportSummary, type ExportFormat } from '@/features/export/assemble';
import { fetchExportData } from '@/features/export/fetch';
import { shareExportFile } from '@/features/export/share';
import { toast, toastError } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session';

const OPTIONS: { format: ExportFormat; icon: LucideIcon; title: string; description: string }[] = [
  {
    format: 'csv',
    icon: FileSpreadsheet,
    title: 'Spreadsheet (CSV)',
    description:
      'One row per book: title, authors, ISBN, collection, status. Opens in Excel or Sheets.',
  },
  {
    format: 'json',
    icon: Braces,
    title: 'Full backup (JSON)',
    description:
      'Books, collections, loan history as lender and borrower, your reviews and your reading.',
  },
];

export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat) => {
    const { user, profile } = useSessionStore.getState();
    if (!user) return;
    setBusy(format);
    try {
      const data = await fetchExportData(user.uid, profile);
      const file = assembleExport(format, data);
      const result = await shareExportFile(file);
      onOpenChange(false);
      if (result === 'downloaded') toast.success(`Downloaded ${file.fileName}`);
      else toast.success('Export ready', { description: exportSummary(data) });
    } catch (e) {
      toastError(e, 'Couldn’t create the export. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent className="gap-4">
        <DialogHeader>
          <DialogTitle>Export your data</DialogTitle>
          <DialogDescription>
            {Platform.OS === 'web'
              ? 'The file is created on this device and downloaded.'
              : 'The file is created on your phone and opens the share sheet. Nothing is uploaded.'}
          </DialogDescription>
        </DialogHeader>
        <View className="gap-2">
          {OPTIONS.map((o) => (
            <Pressable
              key={o.format}
              onPress={() => void run(o.format)}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel={`Export ${o.title}`}
              className={cn(
                'flex-row items-center gap-3 rounded-lg border border-border p-3 active:bg-accent',
                busy && busy !== o.format && 'opacity-50'
              )}
            >
              <View className="size-10 items-center justify-center rounded-md bg-muted">
                <Icon as={o.icon} size={20} className="text-foreground" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold">{o.title}</Text>
                <Text className="text-xs leading-4 text-muted-foreground">{o.description}</Text>
              </View>
              {busy === o.format ? (
                <ActivityIndicator size="small" />
              ) : (
                <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
              )}
            </Pressable>
          ))}
        </View>
      </DialogContent>
    </Dialog>
  );
}
