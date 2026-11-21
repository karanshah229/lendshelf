/// <reference types="expo/types" />

// Expo inlines EXPO_PUBLIC_* variables at build time.
declare namespace NodeJS {
  interface ProcessEnv {
    /** Download link in invite messages (UX H1). Unset: a placeholder line. */
    readonly EXPO_PUBLIC_INVITE_URL?: string;
  }
}
