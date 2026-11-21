/// <reference types="expo/types" />

// Expo inlines EXPO_PUBLIC_* variables at build time.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_USE_EMULATORS?: string;
    readonly EXPO_PUBLIC_EMULATOR_HOST?: string;
    readonly EXPO_PUBLIC_EMULATOR_PORT_OFFSET?: string;
    /** Download link in invite messages (UX H1). Unset: a placeholder line. */
    readonly EXPO_PUBLIC_INVITE_URL?: string;
  }
}
