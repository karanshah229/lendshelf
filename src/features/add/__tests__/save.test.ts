import {
  chunkCopyWrites,
  coverContentType,
  MAX_COPIES_PER_BATCH,
  type CopyWrite,
} from '@/features/add/save';

// save.ts imports the Firebase module; keep the test free of SDK setup.
jest.mock('@/lib/firebase', () => ({}));

const copy = (n: number, custom: boolean): CopyWrite => ({
  work: custom ? { path: `works/custom_${n}`, data: {} } : undefined,
  item: { path: `items/i${n}`, data: { workId: custom ? `custom_${n}` : `ol_${n}` } },
});

describe('chunkCopyWrites', () => {
  it('commits at most 19 copies per batch (Firestore: 20 reads per request)', () => {
    expect(MAX_COPIES_PER_BATCH).toBe(19);
    const copies = Array.from({ length: 45 }, (_, i) => copy(i, i % 2 === 0));
    const batches = chunkCopyWrites(copies);
    const itemCounts = batches.map((b) => b.filter((w) => w.path.startsWith('items/')).length);
    expect(itemCounts).toEqual([19, 19, 7]);
    // Every copy is written exactly once, in order.
    expect(batches.flat().filter((w) => w.path.startsWith('items/'))).toHaveLength(45);
    expect(batches.flat()[0]!.path).toBe('works/custom_0');
  });

  it('keeps each new custom Book in the same batch as its copy, just before it', () => {
    const copies = Array.from({ length: 40 }, (_, i) => copy(i, true));
    for (const batch of chunkCopyWrites(copies)) {
      expect(batch.length % 2).toBe(0);
      for (let i = 0; i < batch.length; i += 2) {
        const work = batch[i]!;
        const item = batch[i + 1]!;
        expect(work.path).toMatch(/^works\/custom_/);
        expect(item.data.workId).toBe(work.path.slice('works/'.length));
      }
    }
  });

  it('handles empty input, exact multiples and custom sizes', () => {
    expect(chunkCopyWrites([])).toEqual([]);
    expect(chunkCopyWrites(Array.from({ length: 19 }, (_, i) => copy(i, false)))).toHaveLength(1);
    expect(chunkCopyWrites(Array.from({ length: 38 }, (_, i) => copy(i, false)))).toHaveLength(2);
    expect(chunkCopyWrites([copy(1, false), copy(2, false), copy(3, true)], 2)).toEqual([
      [copy(1, false).item, copy(2, false).item],
      [copy(3, true).work, copy(3, true).item],
    ]);
    // A nonsense size still makes progress.
    expect(chunkCopyWrites([copy(1, false), copy(2, false)], 0)).toHaveLength(2);
  });
});

describe('coverContentType', () => {
  it('normalises image/jpg and keeps supported types', () => {
    expect(coverContentType('image/jpg', 'file:///a.jpg')).toBe('image/jpeg');
    expect(coverContentType('IMAGE/JPEG', 'file:///a')).toBe('image/jpeg');
    expect(coverContentType('image/png', 'file:///a.png')).toBe('image/png');
    expect(coverContentType('image/webp', 'x')).toBe('image/webp');
    expect(coverContentType('image/heic', 'x')).toBe('image/heic');
    expect(coverContentType('image/heif', 'x')).toBe('image/heif');
  });

  it('rejects types Storage rules refuse', () => {
    expect(coverContentType('image/gif', 'file:///a.gif')).toBeNull();
    expect(coverContentType('image/svg+xml', 'file:///a.svg')).toBeNull();
    expect(coverContentType('application/pdf', 'file:///a.pdf')).toBeNull();
    expect(coverContentType(null, 'data:image/gif;base64,AAAA')).toBeNull();
    expect(coverContentType(null, 'file:///photos/a.gif')).toBeNull();
  });

  it('infers the type from a data: URI or extension when the picker gives none', () => {
    expect(coverContentType(null, 'data:image/png;base64,AAAA')).toBe('image/png');
    expect(coverContentType(undefined, 'data:image/jpg;base64,AAAA')).toBe('image/jpeg');
    expect(coverContentType(null, 'file:///photos/a.JPEG')).toBe('image/jpeg');
    expect(coverContentType('', 'file:///photos/a.heic?x=1')).toBe('image/heic');
    // Unknown: the picker's default output (JPEG), as before.
    expect(coverContentType(null, 'blob:http://localhost:8081/7f3a')).toBe('image/jpeg');
  });
});
