/**
 * Firebase for Android and iOS (React Native Firebase, modular API).
 * The web build resolves `index.ts` instead; both files export the same surface.
 * App code must import from `@/lib/firebase` only.
 *
 * Native config comes from google-services.json / GoogleService-Info.plist (see app.config.ts).
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  type User as NativeUser,
} from '@react-native-firebase/auth';
import { connectFirestoreEmulator, getFirestore } from '@react-native-firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from '@react-native-firebase/functions';
import {
  connectStorageEmulator,
  getDownloadURL,
  getStorage,
  putFile,
  ref as storageRef,
} from '@react-native-firebase/storage';

import { EMULATOR_HOST, EMULATOR_PORTS, FUNCTIONS_REGION, USE_EMULATORS } from './config';
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
} from '@react-native-firebase/firestore';

const app = getApp();
const auth = getAuth(app);
export const db = getFirestore(app);
const functions = getFunctions(app, FUNCTIONS_REGION);
const storage = getStorage(app);

const g = globalThis as { __lendshelfEmulatorsConnected?: boolean };
if (USE_EMULATORS && !g.__lendshelfEmulatorsConnected) {
  g.__lendshelfEmulatorsConnected = true;
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`);
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  connectFunctionsEmulator(functions, EMULATOR_HOST, EMULATOR_PORTS.functions);
  connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage);
}

function toAuthUser(user: NativeUser): AuthUser {
  return { uid: user.uid, phoneNumber: user.phoneNumber };
}

/**
 * Android 17+ blocks connections to private addresses (such as the emulators on 10.0.2.2 or a
 * LAN IP) unless the app holds ACCESS_LOCAL_NETWORK, a runtime permission. Emulator mode only;
 * app.config.ts declares the permission when EXPO_PUBLIC_USE_EMULATORS=1.
 */
async function ensureLocalNetworkAccess(): Promise<void> {
  if (!USE_EMULATORS || Platform.OS !== 'android' || Number(Platform.Version) < 37) return;
  const permission = PermissionsAndroid.PERMISSIONS.ACCESS_LOCAL_NETWORK;
  if (!permission || (await PermissionsAndroid.check(permission))) return;
  await PermissionsAndroid.request(permission, {
    title: 'Allow local network access',
    message: 'This development build talks to the Firebase emulators on your computer.',
    buttonPositive: 'OK',
  });
}

// ---------- Auth ----------

/** Sends an SMS code to `phone` (E.164). Resolve the returned handle with the code. */
export async function startPhoneSignIn(phone: string): Promise<PhoneSignIn> {
  await ensureLocalNetworkAccess();
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
