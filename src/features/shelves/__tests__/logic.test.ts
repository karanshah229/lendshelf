import {
  cleanShelfName,
  defaultMoveTarget,
  moveShelf,
  nextSortOrder,
  validateShelfName,
} from '@/features/shelves/logic';

describe('moveShelf', () => {
  const shelves = [
    { id: 'a', sortOrder: 0 },
    { id: 'b', sortOrder: 1 },
    { id: 'c', sortOrder: 2 },
  ];

  it('swaps with the neighbour and writes only changed orders', () => {
    expect(moveShelf(shelves, 'c', 'up')).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
    expect(moveShelf(shelves, 'a', 'down')).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
    ]);
  });

  it('does nothing at the edges or for unknown ids', () => {
    expect(moveShelf(shelves, 'a', 'up')).toEqual([]);
    expect(moveShelf(shelves, 'c', 'down')).toEqual([]);
    expect(moveShelf(shelves, 'x', 'up')).toEqual([]);
  });

  it('renumbers messy or duplicate sort orders', () => {
    const messy = [
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 0 },
      { id: 'c', sortOrder: 7 },
    ];
    expect(moveShelf(messy, 'b', 'down')).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });
});

describe('shelf helpers', () => {
  it('puts new shelves last', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(
      nextSortOrder([
        { id: 'a', sortOrder: 0 },
        { id: 'b', sortOrder: 4 },
      ])
    ).toBe(5);
  });

  it('validates names', () => {
    const existing = [{ id: 'a', name: 'My books' }];
    expect(cleanShelfName('  Kids   room ')).toBe('Kids room');
    expect(validateShelfName('   ', existing)).toMatch(/name/);
    expect(validateShelfName('x'.repeat(41), existing)).toMatch(/40/);
    expect(validateShelfName('my BOOKS', existing)).toMatch(/already/);
    expect(validateShelfName('My books', existing, 'a')).toBeNull();
    expect(validateShelfName('Cookbooks', existing)).toBeNull();
  });

  it('picks where deleted copies go', () => {
    const list = [{ id: 'x' }, { id: 'default_u' }, { id: 'y' }];
    expect(defaultMoveTarget(list, 'x', 'default_u')).toBe('default_u');
    expect(defaultMoveTarget(list, 'default_u', 'default_u')).toBe('x');
    expect(defaultMoveTarget([{ id: 'x' }], 'x', 'default_u')).toBeNull();
  });
});
