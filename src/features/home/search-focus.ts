import { router } from 'expo-router';
import { create } from 'zustand';

/**
 * "Find a book" (Loans' empty state, E2a ii): go to Home and put the cursor in its search.
 * A counter rather than a URL param, so no `?focus=` is left in the address bar.
 */
export const useHomeSearchFocus = create<{ token: number }>()(() => ({ token: 0 }));

export function goFindABook(): void {
  useHomeSearchFocus.setState((s) => ({ token: s.token + 1 }));
  router.navigate('/');
}
