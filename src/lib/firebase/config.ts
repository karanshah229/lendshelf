import { Platform } from 'react-native';

/** Firebase project used for local development against the Emulator Suite. */
export const DEMO_PROJECT_ID = 'demo-lendshelf';

/** Region of every callable Cloud Function (SPEC §5). */
export const FUNCTIONS_REGION = 'asia-south1';

/** `EXPO_PUBLIC_USE_EMULATORS=1` points the app at the local Firebase Emulator Suite. */
export const USE_EMULATORS = process.env.EXPO_PUBLIC_USE_EMULATORS === '1';

/**
 * Host the emulators are reachable on. The Android emulator reaches the host machine on 10.0.2.2;
 * web and the iOS simulator use the loopback address. Override with `EXPO_PUBLIC_EMULATOR_HOST`
 * (e.g. your LAN IP when testing on a physical device).
 */
export const EMULATOR_HOST =
  process.env.EXPO_PUBLIC_EMULATOR_HOST || (Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1');

/** Emulator ports (firebase.json). `EXPO_PUBLIC_EMULATOR_PORT_OFFSET` shifts them all, e.g. 10000. */
const PORT_OFFSET = Number(process.env.EXPO_PUBLIC_EMULATOR_PORT_OFFSET) || 0;
export const EMULATOR_PORTS = {
  auth: 9099 + PORT_OFFSET,
  firestore: 8080 + PORT_OFFSET,
  functions: 5001 + PORT_OFFSET,
  storage: 9199 + PORT_OFFSET,
} as const;

/**
 * Web config. The web build exists only for development and demos against the emulators,
 * so a dummy API key is fine. Override via EXPO_PUBLIC_FIREBASE_* to point at a real project.
 */
export const WEB_FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || `${DEMO_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || DEMO_PROJECT_ID,
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || `${DEMO_PROJECT_ID}.appspot.com`,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000',
};

/** URL of the Auth emulator's REST endpoint listing pending SMS verification codes. */
export function emulatorVerificationCodesUrl(projectId: string = DEMO_PROJECT_ID): string {
  return `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}/emulator/v1/projects/${projectId}/verificationCodes`;
}
