import type { ConfigContext, ExpoConfig } from 'expo/config';

const APP_ID = 'com.lendshelf.app';

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
    // Placeholder for the `demo-lendshelf` emulator project. Replace with the real file
    // downloaded from the Firebase console before building against a real project.
    googleServicesFile: './GoogleService-Info.plist',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: APP_ID,
    // Placeholder for the `demo-lendshelf` emulator project (see google-services.json).
    googleServicesFile: './google-services.json',
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
    firebaseProjectId: 'demo-lendshelf',
  },
});
