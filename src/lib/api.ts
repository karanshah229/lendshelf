/**
 * Typed wrappers for every callable Cloud Function (SPEC §5). Names and payloads match the spec.
 * Dates cross the wire as ISO strings.
 */
import { callable } from '@/lib/firebase';
import type { Work } from '@/types/model';

// ---------- Profile & contacts ----------

export interface CompleteProfileRequest {
  name: string;
  /** Optional; '' or null clears it. Omit to leave unchanged. */
  pickupNote?: string | null;
}
export interface OkResponse {
  ok: boolean;
}

export interface SyncContactsRequest {
  /** E.164 numbers, at most 5000. */
  phones: string[];
}
export interface SyncedLink {
  ownerId: string;
  ownerPhone: string;
  /** The owner's profile name (null if they haven't set one yet). */
  name: string | null;
}
export interface SyncContactsResponse {
  links: SyncedLink[];
}

// ---------- Books ----------

export type ResolveBookRequest =
  { isbn: string } | { olWorkKey: string; isbn?: string } | { gbVolumeId: string; isbn?: string };

/** `work` as returned over the wire: timestamps are not meaningful client-side. */
export type ResolvedWork = Omit<Work, 'createdAt' | 'updatedAt'>;

export interface ResolvedEdition {
  isbn: string | null;
  coverUrl: string | null;
  language: string | null;
  publisher: string | null;
  publishYear: number | null;
}

export interface ResolveBookResponse {
  workId: string;
  work: ResolvedWork;
  edition: ResolvedEdition;
}

// ---------- Shelves ----------

export interface SetShelfVisibilityRequest {
  shelfId: string;
  isPublic: boolean;
}
export interface SetShelfVisibilityResponse {
  /** Number of items whose `sharedWithContacts` changed. */
  updated: number;
}

export interface DeleteShelfRequest {
  shelfId: string;
  moveToShelfId: string;
}
export interface DeleteShelfResponse {
  moved: number;
}

// ---------- Loans ----------

export interface RequestLoanRequest {
  itemId: string;
  message?: string;
}
export interface RequestLoanResponse {
  loanId: string;
  ownerPhone: string;
}

export interface RespondToRequestRequest {
  loanId: string;
  accept: boolean;
  /** ISO date; defaults to +21 days on the server. */
  dueDate?: string;
}

export interface LoanIdRequest {
  loanId: string;
}

export interface RecordLoanRequest {
  itemId: string;
  borrowerName: string;
  /** E.164 */
  borrowerPhone?: string;
  /** ISO date */
  dueDate?: string;
}
export interface RecordLoanResponse {
  loanId: string;
}

export interface UpdateDueDateRequest {
  loanId: string;
  /** ISO date */
  dueDate: string;
}

export interface DeleteAccountResponse {
  ok: boolean;
  /** Counts of deleted documents per collection. */
  deleted: Record<string, number>;
}

// ---------- Callables ----------
//
// Error codes worth handling (check with errorCode() from @/lib/errors):
//   resolveBook: 'not-found' → offer a custom book; 'unavailable' → catalogues are down.
//   deleteAccount: sign out client-side after it resolves.

export const api = {
  completeProfile: callable<CompleteProfileRequest, OkResponse>('completeProfile'),
  syncContacts: callable<SyncContactsRequest, SyncContactsResponse>('syncContacts'),
  resolveBook: callable<ResolveBookRequest, ResolveBookResponse>('resolveBook'),
  setShelfVisibility: callable<SetShelfVisibilityRequest, SetShelfVisibilityResponse>(
    'setShelfVisibility'
  ),
  deleteShelf: callable<DeleteShelfRequest, DeleteShelfResponse>('deleteShelf'),
  requestLoan: callable<RequestLoanRequest, RequestLoanResponse>('requestLoan'),
  respondToRequest: callable<RespondToRequestRequest, OkResponse>('respondToRequest'),
  cancelRequest: callable<LoanIdRequest, OkResponse>('cancelRequest'),
  recordLoan: callable<RecordLoanRequest, RecordLoanResponse>('recordLoan'),
  markReturned: callable<LoanIdRequest, OkResponse>('markReturned'),
  confirmReturn: callable<LoanIdRequest, OkResponse>('confirmReturn'),
  updateDueDate: callable<UpdateDueDateRequest, OkResponse>('updateDueDate'),
  deleteAccount: callable<Record<string, never>, DeleteAccountResponse>('deleteAccount'),
} as const;

export type Api = typeof api;
