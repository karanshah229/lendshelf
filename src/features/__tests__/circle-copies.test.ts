import {
  circleCopiesForWork,
  rankCircleCopies,
  summarizeCircleCopies,
  type CircleItem,
} from '@/features/book/circle-copies';
import type { TimestampLike } from '@/types/model';

const ts = (iso: string): TimestampLike => {
  const d = new Date(iso);
  return {
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
};

const copy = (id: string, over: Partial<CircleItem> = {}): CircleItem => ({
  id,
  ownerId: 'other',
  workId: 'w1',
  visibility: 'lendable',
  loanState: 'available',
  dueDate: null,
  ...over,
});

describe('rankCircleCopies', () => {
  it('splits mine from others and ranks available, requested, lent (soonest back), not lendable', () => {
    const copies = [
      copy('hidden', { ownerId: 'b', visibility: 'visible' }),
      copy('lentLater', { ownerId: 'c', loanState: 'lent', dueDate: ts('2026-12-20') }),
      copy('mine', { ownerId: 'me' }),
      copy('requested', { ownerId: 'd' }),
      copy('lentSoon', { ownerId: 'e', loanState: 'lent', dueDate: ts('2026-12-01') }),
      copy('lentNoDate', { ownerId: 'f', loanState: 'lent' }),
      copy('avail', { ownerId: 'g' }),
    ];
    const { mine, others } = rankCircleCopies(copies, {
      uid: 'me',
      requestedItemIds: new Set(['requested', 'mine']),
    });
    expect(mine.map((c) => c.item.id)).toEqual(['mine']);
    // My own copy is never "requested by me".
    expect(mine[0]!.status.kind).toBe('available');
    expect(others.map((c) => c.item.id)).toEqual([
      'avail',
      'requested',
      'lentSoon',
      'lentLater',
      'lentNoDate',
      'hidden',
    ]);
  });

  it('dedupes by id and breaks ties by owner name', () => {
    const names: Record<string, string> = { x: 'Zoya', y: 'Asha' };
    const { others } = rankCircleCopies(
      [copy('1', { ownerId: 'x' }), copy('2', { ownerId: 'y' }), copy('1', { ownerId: 'x' })],
      { uid: 'me', nameOf: (id) => names[id] ?? id }
    );
    expect(others.map((c) => c.item.id)).toEqual(['2', '1']);
  });
});

describe('circleCopiesForWork + summarizeCircleCopies', () => {
  it('filters by work and summarises', () => {
    const ranked = circleCopiesForWork(
      'w1',
      [
        copy('a', { ownerId: 'r' }),
        copy('b', { ownerId: 'r' }),
        copy('c', { ownerId: 's', loanState: 'lent' }),
        copy('d', { ownerId: 'me' }),
        copy('e', { ownerId: 't', workId: 'w2' }),
      ],
      { uid: 'me' }
    );
    const s = summarizeCircleCopies(ranked);
    expect(s).toMatchObject({
      othersCount: 3,
      availableCount: 2,
      mineCount: 1,
      ownerIds: ['r', 's'],
      availableOwnerIds: ['r'],
    });
    expect(s.bestStatus?.kind).toBe('available');
  });

  it('has no best status when only I own it', () => {
    const s = summarizeCircleCopies(
      circleCopiesForWork('w1', [copy('m', { ownerId: 'me' })], { uid: 'me' })
    );
    expect(s.bestStatus).toBeNull();
    expect(s.mineCount).toBe(1);
  });
});
