/// <reference types="node" />
// Runs in Node when Expo reads the config (not in the app bundle).
import { existsSync, readFileSync } from 'node:fs';

import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_ID = 'com.lendshelf.app';

/**
 * Which Firebase project a build talks to (read when the app is bundled or prebuilt):
 *   emulator: the local Emulator Suite (`demo-lendshelf`); placeholder config files in the repo root.
 *   dev / prod: the real `lendshelf-dev` / `lendshelf-prod` projects; config files come from
 *   firebase-config/<env>/ (git-ignored; `npm run firebase:config` downloads them).
 * Default: emulator when EXPO_PUBLIC_USE_EMULATORS=1, otherwise dev. Prod is never implicit.
 */
const APP_ENV =
  process.env.APP_ENV ?? (process.env.EXPO_PUBLIC_USE_EMULATORS === '1' ? 'emulator' : 'dev');
if (!['emulator', 'dev', 'prod'].includes(APP_ENV)) {
  throw new Error(`APP_ENV must be emulator, dev or prod (got "${APP_ENV}")`);
}
if (APP_ENV !== 'emulator' && process.env.EXPO_PUBLIC_USE_EMULATORS === '1') {
  throw new Error(`APP_ENV=${APP_ENV} can't be combined with EXPO_PUBLIC_USE_EMULATORS=1`);
}

function firebaseFile(name: string): string {
  if (APP_ENV === 'emulator') return `./${name}`;
  const path = `./firebase-config/${APP_ENV}/${name}`;
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run \`npm run firebase:config\` (needs the Firebase CLI login).`);
  }
  return path;
}

/** Web SDK config for dev/prod web builds; null for the emulator (config.ts uses demo values). */
function webConfig(): Record<string, string> | null {
  if (APP_ENV === 'emulator') return null;
  return JSON.parse(readFileSync(firebaseFile('web.json'), 'utf8')) as Record<string, string>;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LendShelf',
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
    // Android 17+ needs this runtime permission to reach the emulators on 10.0.2.2 / a LAN IP
    // (src/lib/firebase/index.native.ts asks for it). Only emulator builds declare it; debug
    // builds get it from React Native's dev support anyway.
    ...(process.env.EXPO_PUBLIC_USE_EMULATORS === '1'
      ? { permissions: ['android.permission.ACCESS_LOCAL_NETWORK'] }
      : {}),
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
          // The Auth/Firestore emulators run over plain HTTP on 10.0.2.2 in development.
          // Production builds keep Android's default (HTTPS only).
          usesCleartextTraffic: process.env.EXPO_PUBLIC_USE_EMULATORS === '1',
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
    appEnv: APP_ENV,
    firebaseWeb: webConfig(),
  },
});
