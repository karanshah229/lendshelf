/**
 * SDK-neutral types shared by `index.ts` (web, Firebase JS SDK) and `index.native.ts`
 * (React Native Firebase). App code should use these instead of SDK-specific types.
 */

/** The signed-in Firebase user, reduced to what the app needs. */
export interface AuthUser {
  uid: string;
  phoneNumber: string | null;
}

/** Returned by `startPhoneSignIn`; call `confirm` with the SMS code to finish signing in. */
export interface PhoneSignIn {
  confirm(code: string): Promise<AuthUser>;
}

export type Unsubscribe = () => void;

export type CallableFn<TReq, TRes> = (data: TReq) => Promise<TRes>;
