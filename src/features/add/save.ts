/**
 * Writes new copies (and, for hand-entered books, the Book itself) to Firestore.
 * Copies are committed in batches of at most 19 (see `chunkCopyWrites`); a new custom Book is
 * always in the same batch as its copy so the rules' getAfter() sees them together.
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

// ---------- Cover photos ----------

/** Content types Storage rules accept for covers (raster only). */
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export type CoverContentType = (typeof COVER_TYPES)[number];

export const UNSUPPORTED_COVER_MESSAGE =
  'That image type isn’t supported. Use a JPEG, PNG, WebP or HEIC photo.';

const EXT_TYPES: Record<string, CoverContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/**
 * The upload content type for a picked cover photo, or `null` if Storage would reject it
 * (e.g. GIF, SVG). Normalises `image/jpg` → `image/jpeg`. Without a MIME type it is read from a
 * `data:` URI or the file extension; if still unknown, JPEG (what the picker produces).
 */
export function coverContentType(mime: string | null | undefined, uri: string): CoverContentType | null {
  let type = mime?.trim().toLowerCase() || null;
  if (!type) {
    type = /^data:([^;,]+)/i.exec(uri)?.[1]?.toLowerCase() ?? null;
  }
  if (!type) {
    const ext = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(uri)?.[1]?.toLowerCase();
    if (ext && EXT_TYPES[ext]) return EXT_TYPES[ext];
    if (ext && /^(gif|svg|bmp|tiff?|avif|ico)$/.test(ext)) return null;
    return 'image/jpeg';
  }
  if (type === 'image/jpg' || type === 'image/pjpeg') type = 'image/jpeg';
  return (COVER_TYPES as readonly string[]).includes(type) ? (type as CoverContentType) : null;
}

const EXTENSION: Record<CoverContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

// ---------- Batching ----------

/**
 * Firestore allows 20 document reads per batched write. Each copy may read its (existing)
 * custom Book, and the shelf read is shared, so 19 copies per batch is always safe
 * (functions/README "Batch size for new copies").
 */
export const MAX_COPIES_PER_BATCH = 19;

export type DocWrite = { path: string; data: Record<string, unknown> };

/** One copy to write, with the new custom Book it needs (if any). */
export interface CopyWrite {
  work?: DocWrite;
  item: DocWrite;
}

/**
 * Splits copies into batches of at most `max` copies. A copy's new Book goes in the same batch,
 * just before it.
 */
export function chunkCopyWrites(
  copies: readonly CopyWrite[],
  max: number = MAX_COPIES_PER_BATCH
): DocWrite[][] {
  const size = Math.max(1, Math.floor(max));
  const batches: DocWrite[][] = [];
  for (let i = 0; i < copies.length; i += size) {
    batches.push(copies.slice(i, i + size).flatMap((c) => (c.work ? [c.work, c.item] : [c.item])));
  }
  return batches;
}

function coverError(): Error {
  // A code without a "/" makes errorMessage() show the message as-is.
  return Object.assign(new Error(UNSUPPORTED_COVER_MESSAGE), { code: 'invalid-argument' });
}

/**
 * Adds one copy per candidate to `shelf`. Hand-entered books are created in the same batch as
 * their copy (`works/custom_<autoId>`), after uploading their cover photo.
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
  const copies: CopyWrite[] = [];

  // Check every cover before uploading anything.
  for (const c of candidates) {
    const local = c.newWork?.localCoverUri;
    if (!c.workId && local && !coverContentType(c.newWork?.coverMimeType, local)) {
      throw coverError();
    }
  }

  for (const c of candidates) {
    let workId = c.workId;
    let coverUrl = c.coverUrl;
    let work: DocWrite | undefined;

    if (!workId) {
      const autoId = doc(collection(db, COLLECTIONS.works)).id;
      workId = `custom_${autoId}`;
      // A new book's candidate shows the local photo; only the uploaded URL is stored.
      coverUrl = null;
      const local = c.newWork?.localCoverUri;
      if (local) {
        const type = coverContentType(c.newWork?.coverMimeType, local);
        if (!type) throw coverError();
        coverUrl = await uploadFile(`covers/${uid}/${autoId}.${EXTENSION[type]}`, local, type);
      }
      work = {
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
      };
    }

    const itemId = doc(collection(db, COLLECTIONS.items)).id;
    itemIds.push(itemId);
    copies.push({
      work,
      item: {
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
      },
    });
  }

  for (const writes of chunkCopyWrites(copies)) {
    const batch = writeBatch(db);
    for (const w of writes) batch.set(doc(db, w.path), w.data);
    await batch.commit();
  }
  return itemIds;
}
