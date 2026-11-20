import { isDeleteConfirmed } from '@/features/me/delete-confirmation';

describe('isDeleteConfirmed', () => {
  it('needs exactly DELETE (surrounding spaces ignored)', () => {
    expect(isDeleteConfirmed('DELETE')).toBe(true);
    expect(isDeleteConfirmed('  DELETE ')).toBe(true);
    expect(isDeleteConfirmed('delete')).toBe(false);
    expect(isDeleteConfirmed('DELET')).toBe(false);
    expect(isDeleteConfirmed('')).toBe(false);
  });
});
