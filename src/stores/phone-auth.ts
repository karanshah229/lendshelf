/**
 * Hand-off between the Phone and Code screens: the number being verified and the pending
 * confirmation (not serialisable, so it can't travel as a route param).
 */
import { create } from 'zustand';

import type { PhoneSignIn } from '@/lib/firebase';

interface PhoneAuthState {
  /** E.164 */
  phone: string | null;
  pending: PhoneSignIn | null;
  sentAt: number | null;
  setPending(phone: string, pending: PhoneSignIn): void;
  clear(): void;
}

export const usePhoneAuthStore = create<PhoneAuthState>()((set) => ({
  phone: null,
  pending: null,
  sentAt: null,
  setPending(phone, pending) {
    set({ phone, pending, sentAt: Date.now() });
  },
  clear() {
    set({ phone: null, pending: null, sentAt: null });
  },
}));
