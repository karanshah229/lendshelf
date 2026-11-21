import type { Href } from 'expo-router';

/**
 * Push payloads from the backend carry `data.type` plus `loanId` / `itemId` / `workId`
 * (functions/src/lib/messages.ts). Decides where a tap on the notification goes (UX §E12):
 * every loan push opens the Loan screen; "book is back", "available again" and wishlist pushes
 * open the copy.
 */
export interface PushData {
  type?: string;
  loanId?: string;
  itemId?: string;
  workId?: string;
  [key: string]: unknown;
}

/** Push types that open `/copy/[itemId]` even if they also carry a loan id. */
const COPY_TYPES = new Set(['itemBack', 'wishlistAdded', 'availableAgain']);

export function routeForNotification(data: unknown): Href | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as PushData;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const itemId = str(d.itemId);
  const workId = str(d.workId);
  const loanId = str(d.loanId);

  if (d.type === 'reviewPrompt') {
    // "How was it?" lives on the closed loan; older payloads only had the work id.
    if (loanId) return { pathname: '/loan/[loanId]', params: { loanId, review: '1' } };
    if (workId) return { pathname: '/review/[workId]', params: { workId } };
  }
  if (d.type && COPY_TYPES.has(d.type) && itemId) {
    return { pathname: '/copy/[itemId]', params: { itemId } };
  }
  if (loanId) return { pathname: '/loan/[loanId]', params: { loanId } };
  if (itemId) return { pathname: '/copy/[itemId]', params: { itemId } };
  if (workId) return { pathname: '/book/[workId]', params: { workId } };
  return null;
}

/**
 * A detail screen for a link path (`lendshelf://loan/abc`, `/copy/xyz`), or null when the path
 * isn't one. Used to keep the target through sign-in and onboarding (F1 rule 4).
 */
export function hrefFromPath(path: string | null | undefined): Href | null {
  if (!path) return null;
  const clean = path.split(/[?#]/)[0]!.replace(/^\/+|\/+$/g, '');
  const m = /^(loan|copy|book|person)\/([^/]+)$/.exec(clean);
  if (!m) return null;
  const id = decodeURIComponent(m[2]!);
  switch (m[1]) {
    case 'loan':
      return { pathname: '/loan/[loanId]', params: { loanId: id } };
    case 'copy':
      return { pathname: '/copy/[itemId]', params: { itemId: id } };
    case 'book':
      return { pathname: '/book/[workId]', params: { workId: id } };
    default:
      return { pathname: '/person/[uid]', params: { uid: id } };
  }
}
