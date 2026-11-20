/** Web: download the export through a Blob URL and a temporary anchor. */
import type { ExportFile } from '@/features/export/assemble';

export type ShareResult = 'shared' | 'downloaded';

export async function shareExportFile(file: ExportFile): Promise<ShareResult> {
  const blob = new Blob([file.content], { type: `${file.mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser a moment to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return 'downloaded';
}
