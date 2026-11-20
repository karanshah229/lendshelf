/**
 * Writes new copies (and, for hand-entered books, the Book itself) to Firestore.
 * All documents go in one batch per 400 writes so the rules' getAfter() sees a new
 * custom Book and its copy together.
 */
import { collection, db, doc, serverTimestamp, uploadFile, writeBatch } from '@/lib/firebase';
import {
  buildNewItem,
  COLLECTIONS,
  type ItemFormat,
  type Shelf,
  type Visibility,
  type WithId,
} from '@/types/model';

import type { AddCandidate } from './types';

export interface CopySettings {
  shelfId: string;
  visibility: Visibility;
  format: ItemFormat | null;
  /** `'auto'` keeps each book's detected language (batch adds). */
  language: string | 'auto' | null;
}

/** "Jane Austen, ,  Someone Else" → ["Jane Austen", "Someone Else"] (max 20, de-duplicated). */
export function parseAuthors(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[,;\n]/)) {
    const name = part.trim().replace(/\s+/g, ' ').slice(0, 200);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 20);
}

export function languageFor(candidate: AddCandidate, settings: CopySettings): string | null {
  return settings.language === 'auto' ? candidate.language : settings.language;
}

const MAX_BATCH = 400;

function extensionFor(mime: string | null, uri: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic') return 'heic';
  const m = /\.(jpe?g|png|webp|heic)(?:\?|$)/i.exec(uri);
  return m ? (m[1] as string).toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

/**
 * Adds one copy per candidate to `shelf`. Hand-entered books are created first in the same
 * batch (`works/custom_<autoId>`), after uploading their cover photo.
 * Returns the new item ids, in candidate order.
 */
export async function addCopies(params: {
  uid: string;
  shelf: WithId<Shelf>;
  candidates: AddCandidate[];
  settings: CopySettings;
}): Promise<string[]> {
  const { uid, shelf, candidates, settings } = params;
  const now = serverTimestamp();
  const itemIds: string[] = [];

  type Write = { path: string; data: Record<string, unknown> };
  const writes: Write[] = [];

  for (const c of candidates) {
    let workId = c.workId;
    let coverUrl = c.coverUrl;

    if (!workId) {
      const autoId = doc(collection(db, COLLECTIONS.works)).id;
      workId = `custom_${autoId}`;
      // A new book's candidate shows the local photo; only the uploaded URL is stored.
      coverUrl = null;
      if (c.newWork?.localCoverUri) {
        const ext = extensionFor(c.newWork.coverMimeType, c.newWork.localCoverUri);
        coverUrl = await uploadFile(
          `covers/${uid}/${autoId}.${ext}`,
          c.newWork.localCoverUri,
          c.newWork.coverMimeType ?? 'image/jpeg'
        );
      }
      writes.push({
        path: `${COLLECTIONS.works}/${workId}`,
        data: {
          category: 'book',
          source: 'custom',
          title: c.title,
          authors: c.authors,
          description: null,
          coverUrl,
          firstPublishYear: null,
          isCustom: true,
          createdBy: uid,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    const itemId = doc(collection(db, COLLECTIONS.items)).id;
    itemIds.push(itemId);
    writes.push({
      path: `${COLLECTIONS.items}/${itemId}`,
      data: buildNewItem(
        {
          ownerId: uid,
          workId,
          shelfId: shelf.id,
          shelfIsPublic: shelf.isPublic,
          visibility: settings.visibility,
          title: c.title,
          authors: c.authors,
          coverUrl,
          isCustom: c.isCustom,
          isbn: c.isbn,
          format: settings.format,
          language: languageFor(c, settings),
        },
        now
      ),
    });
  }

  for (let i = 0; i < writes.length; i += MAX_BATCH) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + MAX_BATCH)) batch.set(doc(db, w.path), w.data);
    await batch.commit();
  }
  return itemIds;
}
