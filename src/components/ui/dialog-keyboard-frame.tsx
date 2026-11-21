import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

/**
 * Keeps a centred dialog clear of the on-screen keyboard (QA-ANDROID bug 5).
 *
 * The app is edge-to-edge, so Android's adjustResize no longer shrinks the window and the
 * keyboard would sit on top of the dialog's buttons. The frame pads its bottom by the keyboard
 * height (like `Screen` and `AuthShell`) so the dialog re-centres in the space that is left, and
 * scrolls when the dialog is taller than that space. Taps on the backdrop still reach the
 * overlay, and buttons work while the keyboard is up.
 *
 * Native only: on web the browser handles the keyboard and the overlay is `position: fixed`.
 */
export function DialogKeyboardFrame({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') return <>{children}</>;
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, alignSelf: 'stretch' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
