export const DELETE_CONFIRMATION = 'DELETE';

/** Whether the typed confirmation matches (case-sensitive, surrounding spaces ignored). */
export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim() === DELETE_CONFIRMATION;
}
