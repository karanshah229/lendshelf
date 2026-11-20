import type { Href } from 'expo-router';

/**
 * Push payloads from the backend carry `data.type` plus `loanId` / `itemId` / `workId`
 * (functions/src/lib/messages.ts). Decides where a tap on the notification goes.
 */
export interface PushData {
  type?: string;
  loanId?: string;
  itemId?: string;
  workId?: string;
  [key: string]: unknown;
}

export function routeForNotification(data: unknown): Href | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as PushData;
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  const itemId = str(d.itemId);
  const workId = str(d.workId);
  const loanId = str(d.loanId);

  if (d.type === 'reviewPrompt' && workId) {
    return { pathname: '/review/[workId]', params: { workId } };
  }
  if (itemId) return { pathname: '/copy/[itemId]', params: { itemId } };
  if (workId) return { pathname: '/book/[workId]', params: { workId } };
  if (loanId) return '/loans';
  return null;
}
