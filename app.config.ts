/// <reference types="node" />
// Runs in Node when Expo reads the config (not in the app bundle).
import { existsSync, readFileSync } from 'node:fs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Which Firebase project a build talks to (read when the app is bundled or prebuilt):
 *   dev: `lendshelf-dev` (the default); prod: `lendshelf-prod` (never implicit).
 * Config files come from firebase-config/<env>/ (git-ignored; `npm run firebase:config`
 * downloads them), or from the paths in the env vars below (EAS file variables).
 */
const APP_ENV = process.env.APP_ENV || 'dev';
if (APP_ENV !== 'dev' && APP_ENV !== 'prod') {
  throw new Error(`APP_ENV must be dev or prod (got "${APP_ENV}")`);
}

/**
 * Android application id and iOS bundle id. `com.lendshelf.app` unless APP_ID says otherwise.
 * The EAS dev builds (eas.json) use `com.lendshelf.app.dev`, so they install next to the
 * store app and get their own FCM / APNs credentials on EAS; that id must be registered in
 * lendshelf-dev first (README → Push notifications setup). Prod is always `com.lendshelf.app`.
 */
const PROD_APP_ID = 'com.lendshelf.app';
const DEV_APP_ID = 'com.lendshelf.app.dev';
const APP_ID = process.env.APP_ID || PROD_APP_ID;
if (APP_ID !== PROD_APP_ID && APP_ID !== DEV_APP_ID) {
  throw new Error(`APP_ID must be ${PROD_APP_ID} or ${DEV_APP_ID} (got "${APP_ID}")`);
}
if (APP_ENV === 'prod' && APP_ID !== PROD_APP_ID) {
  throw new Error(`APP_ENV=prod builds must use ${PROD_APP_ID} (got APP_ID="${APP_ID}")`);
}

/**
 * EAS project id, needed for Expo push tokens (`src/lib/push.ts`). This config is dynamic, so
 * `eas init` can't write it here: paste it into EAS_PROJECT_ID_DEFAULT (it isn't a secret), or
 * set EAS_PROJECT_ID (or EAS_PROJECT_ID_DEV / _PROD), or put `extra.eas.projectId` in an
 * app.json. Without it, push registration is skipped.
 */
const EAS_PROJECT_ID_DEFAULT = '';
const EAS_PROJECT_ID =
  process.env[`EAS_PROJECT_ID_${APP_ENV.toUpperCase()}`] ||
  process.env.EAS_PROJECT_ID ||
  EAS_PROJECT_ID_DEFAULT;

/**
 * Env vars that may hold the path of a Firebase config file. On EAS they are "file"
 * environment variables (the files are git-ignored, so EAS can't see firebase-config/).
 * Locally they are normally unset.
 */
const FILE_ENV_VARS = {
  'google-services.json': 'GOOGLE_SERVICES_JSON',
  'GoogleService-Info.plist': 'GOOGLE_SERVICE_INFO_PLIST',
  'web.json': 'FIREBASE_WEB_JSON',
} as const;
type FirebaseFile = keyof typeof FILE_ENV_VARS;

/** The env-provided path if that file exists, else firebase-config/<env>/<name>, else null. */
function findFirebaseFile(name: FirebaseFile): string | null {
  const fromEnv = process.env[FILE_ENV_VARS[name]];
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const local = `./firebase-config/${APP_ENV}/${name}`;
  return existsSync(local) ? local : null;
}

function firebaseFile(name: FirebaseFile): string {
  const path = findFirebaseFile(name);
  if (!path) {
    throw new Error(
      `Missing ./firebase-config/${APP_ENV}/${name}. Run \`npm run firebase:config\` (needs the ` +
        `Firebase CLI login), or set ${FILE_ENV_VARS[name]} to the file's path (EAS file variable).`
    );
  }
  return path;
}

/**
 * Web SDK config of the registered web app (src/lib/firebase/config.ts reads it on web only).
 * Native builds on EAS don't need it, so there it may be missing.
 */
function webConfig(): Record<string, string> | null {
  if (process.env.EAS_BUILD === 'true' && !findFirebaseFile('web.json')) return null;
  return JSON.parse(readFileSync(firebaseFile('web.json'), 'utf8')) as Record<string, string>;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_ID === DEV_APP_ID ? 'LendShelf Dev' : 'LendShelf',
  slug: 'lendshelf',
  scheme: 'lendshelf',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: APP_ID,
    supportsTablet: false,
    googleServicesFile: firebaseFile('GoogleService-Info.plist'),
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: APP_ID,
    googleServicesFile: firebaseFile('google-services.json'),
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // expo-contacts also adds WRITE_CONTACTS; LendShelf only reads the address book.
    blockedPermissions: ['android.permission.WRITE_CONTACTS'],
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
        dark: { backgroundColor: '#0A0A0A', image: './assets/images/splash-icon.png' },
      },
    ],
    '@react-native-firebase/app',
    '@react-native-firebase/auth',
    [
      'expo-build-properties',
      {
        // React Native Firebase v27 uses the SPM-only Firebase Apple SDK 13+, which requires
        // dynamic frameworks (static linkage makes `pod install` fail).
        ios: { useFrameworks: 'dynamic' },
        android: {
          // React Native Firebase v27 pulls Firebase BoM 35 (firebase-auth 25), whose Kotlin
          // metadata is 2.4. RN's default Kotlin 2.2 compiler can't read it ("Module was compiled
          // with an incompatible version of Kotlin"); 2.3 can (one version forward-compatible).
          kotlinVersion: '2.3.21',
        },
      },
    ],
    'expo-localization',
    [
      'expo-contacts',
      {
        contactsPermission:
          'LendShelf matches the phone numbers in your contacts to show you books your friends and family are sharing. Your address book is never stored.',
      },
    ],
    'expo-notifications',
    [
      'expo-camera',
      {
        cameraPermission:
          'LendShelf uses the camera to scan the barcodes on your books so you can add them quickly.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'LendShelf lets you pick a photo to use as a book cover.',
        cameraPermission: 'LendShelf lets you take a photo of a book to use as its cover.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Keep anything a static app.json adds (e.g. `eas.projectId` written by `eas init`).
    ...config.extra,
    ...(EAS_PROJECT_ID ? { eas: { ...config.extra?.eas, projectId: EAS_PROJECT_ID } } : {}),
    appEnv: APP_ENV,
    firebaseWeb: webConfig(),
  },
});
