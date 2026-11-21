/**
 * Firebase for Android and iOS (React Native Firebase, modular API).
 * The web build resolves `index.ts` instead; both files export the same surface.
 * App code must import from `@/lib/firebase` only.
 *
 * Native config comes from firebase-config/<env>/google-services.json and
 * GoogleService-Info.plist, picked by APP_ENV in app.config.ts.
 */
import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  type User as NativeUser,
} from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import {
  getDownloadURL,
  getStorage,
  putFile,
  ref as storageRef,
} from '@react-native-firebase/storage';

import { FUNCTIONS_REGION } from './config';
import type { AuthUser, CallableFn, PhoneSignIn, Unsubscribe } from './types';

export type { AuthUser, CallableFn, PhoneSignIn, Unsubscribe } from './types';

export {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';

const app = getApp();
const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app, FUNCTIONS_REGION);
const storage = getStorage(app);

function toAuthUser(user: NativeUser): AuthUser {
  return { uid: user.uid, phoneNumber: user.phoneNumber };
}

// ---------- Auth ----------

/** Sends an SMS code to `phone` (E.164). Resolve the returned handle with the code. */
export async function startPhoneSignIn(phone: string): Promise<PhoneSignIn> {
  const confirmation = await signInWithPhoneNumber(auth, phone);
  return {
    async confirm(code: string) {
      const cred = await confirmation.confirm(code);
      if (!cred?.user) throw new Error('Sign-in did not complete. Please try again.');
      return toAuthUser(cred.user);
    },
  };
}

export function signOut(): Promise<void> {
  return fbSignOut(auth);
}

export function onAuthStateChanged(cb: (user: AuthUser | null) => void): Unsubscribe {
  return fbOnAuthStateChanged(auth, (user: NativeUser | null) =>
    cb(user ? toAuthUser(user) : null)
  );
}

export function getCurrentUser(): AuthUser | null {
  return auth.currentUser ? toAuthUser(auth.currentUser) : null;
}

// ---------- Functions ----------

/** Typed callable Cloud Function in region `asia-south1`. */
export function callable<TReq, TRes>(name: string): CallableFn<TReq, TRes> {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  return async (data: TReq) => (await fn(data)).data;
}

// ---------- Storage ----------

/** Uploads a local file (`file://` URI) to `path` and returns its download URL. */
export async function uploadFile(
  path: string,
  localUri: string,
  contentType?: string
): Promise<string> {
  const r = storageRef(storage, path);
  await putFile(r, localUri, contentType ? { contentType } : undefined);
  return getDownloadURL(r);
}
