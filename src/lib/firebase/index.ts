/**
 * Firebase for the web build (Firebase JS SDK, modular API).
 * The native build resolves `index.native.ts` instead; both files export the same surface.
 * App code must import from `@/lib/firebase` only.
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import {
  connectStorageEmulator,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';

import {
  EMULATOR_HOST,
  EMULATOR_PORTS,
  FUNCTIONS_REGION,
  USE_EMULATORS,
  WEB_FIREBASE_CONFIG,
} from './config';
import type { AuthUser, CallableFn, PhoneSignIn, Unsubscribe } from './types';

export type { AuthUser, CallableFn, PhoneSignIn, Unsubscribe } from './types';
export { USE_EMULATORS, EMULATOR_HOST, emulatorVerificationCodesUrl } from './config';

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
} from 'firebase/firestore';

const app = getApps().length ? getApp() : initializeApp(WEB_FIREBASE_CONFIG);

const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app, FUNCTIONS_REGION);
const storage = getStorage(app);

// Guard against double-connecting during Fast Refresh.
const g = globalThis as { __lendshelfEmulatorsConnected?: boolean };
if (USE_EMULATORS && !g.__lendshelfEmulatorsConnected) {
  g.__lendshelfEmulatorsConnected = true;
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  connectFunctionsEmulator(functions, EMULATOR_HOST, EMULATOR_PORTS.functions);
  connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage);
  // The Auth emulator does not verify reCAPTCHA; skip the real widget entirely.
  auth.settings.appVerificationDisabledForTesting = true;
}

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, phoneNumber: user.phoneNumber };
}

// ---------- Auth ----------

let recaptcha: RecaptchaVerifier | null = null;

/**
 * A fresh invisible verifier per attempt: a verifier that has already produced a token
 * never resolves again (a second sign-in after sign-out would hang).
 */
function freshRecaptchaVerifier(): RecaptchaVerifier {
  try {
    recaptcha?.clear();
  } catch {
    // Already cleared.
  }
  const id = 'lendshelf-recaptcha';
  document.getElementById(id)?.remove();
  const container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  recaptcha = new RecaptchaVerifier(auth, container, { size: 'invisible' });
  return recaptcha;
}

/** Sends an SMS code to `phone` (E.164). Resolve the returned handle with the code. */
export async function startPhoneSignIn(phone: string): Promise<PhoneSignIn> {
  const confirmation = await signInWithPhoneNumber(auth, phone, freshRecaptchaVerifier());
  return {
    async confirm(code: string) {
      const cred = await confirmation.confirm(code);
      return toAuthUser(cred.user);
    },
  };
}

export function signOut(): Promise<void> {
  return fbSignOut(auth);
}

export function onAuthStateChanged(cb: (user: AuthUser | null) => void): Unsubscribe {
  return fbOnAuthStateChanged(auth, (user) => cb(user ? toAuthUser(user) : null));
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

/**
 * Uploads a local file (a `blob:`/`data:`/`file:` URI from an image picker) to `path`
 * and returns its download URL.
 */
export async function uploadFile(
  path: string,
  localUri: string,
  contentType?: string
): Promise<string> {
  const blob = await (await fetch(localUri)).blob();
  const r = storageRef(storage, path);
  await uploadBytes(r, blob, contentType ? { contentType } : undefined);
  return getDownloadURL(r);
}
