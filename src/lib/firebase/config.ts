import Constants from 'expo-constants';

/** Region of every callable Cloud Function (SPEC §5). */
export const FUNCTIONS_REGION = 'asia-south1';

/** Build environment from app.config.ts (`APP_ENV`): dev or prod. */
export const APP_ENV: string = Constants.expoConfig?.extra?.appEnv ?? 'dev';

export type WebFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
};

/**
 * Web SDK config of the registered web app, from app.config.ts (firebase-config/<env>/web.json).
 * Only the web build uses it; native builds read google-services.json / GoogleService-Info.plist.
 */
export const WEB_FIREBASE_CONFIG =
  (Constants.expoConfig?.extra?.firebaseWeb as WebFirebaseConfig | null | undefined) ?? null;

/** The web SDK config, or a clear error when the build has none. */
export function requireWebFirebaseConfig(): WebFirebaseConfig {
  if (!WEB_FIREBASE_CONFIG) {
    throw new Error(
      `Missing Firebase web config for APP_ENV=${APP_ENV} (expo extra.firebaseWeb). ` +
        'Run `npm run firebase:config` to download firebase-config/<env>/web.json, then restart Expo.'
    );
  }
  return WEB_FIREBASE_CONFIG;
}
