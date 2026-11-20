/** Native: write the export to the cache directory and open the share sheet. */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ExportFile } from '@/features/export/assemble';

export type ShareResult = 'shared' | 'downloaded';

export async function shareExportFile(file: ExportFile): Promise<ShareResult> {
  const out = new File(Paths.cache, file.fileName);
  if (out.exists) out.delete();
  out.create();
  await out.write(file.content);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  await Sharing.shareAsync(out.uri, {
    mimeType: file.mimeType,
    UTI: file.uti,
    dialogTitle: 'Export your LendShelf data',
  });
  return 'shared';
}
