/// <reference types="expo/types" />

// Expo inlines EXPO_PUBLIC_* variables at build time.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_USE_EMULATORS?: string;
    readonly EXPO_PUBLIC_EMULATOR_HOST?: string;
    readonly EXPO_PUBLIC_EMULATOR_PORT_OFFSET?: string;
    readonly EXPO_PUBLIC_FIREBASE_API_KEY?: string;
    readonly EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
    readonly EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
    readonly EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
    readonly EXPO_PUBLIC_FIREBASE_APP_ID?: string;
  }
}
