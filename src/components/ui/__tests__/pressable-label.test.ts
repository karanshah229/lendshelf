import * as fs from 'fs';
import * as path from 'path';

import * as React from 'react';
import { View } from 'react-native';

import { buttonLabelClass, buttonTextVariants, FILL_CLASS } from '@/components/ui/button';
import { labelPointerEvents, Text } from '@/components/ui/text';

// The primitives ship untranspiled JSX; the label logic doesn't need them.
jest.mock('@rn-primitives/slot', () => ({ Slot: () => null }));

// QA-ANDROID bug 2: a button label that picks up its own press handlers swallows the tap on
// native, so the button's onPress never fires.

describe('button labels pass touches through (QA-ANDROID bug 2)', () => {
  it('a plain label inside a pressable ignores touches', () => {
    expect(labelPointerEvents(true, {})).toBe('none');
  });

  it('a label that is itself pressable keeps its touches', () => {
    expect(labelPointerEvents(true, { onPress: () => {} })).toBeUndefined();
    expect(labelPointerEvents(true, { onLongPress: () => {} })).toBeUndefined();
  });

  it('text outside a pressable is untouched', () => {
    expect(labelPointerEvents(false, {})).toBeUndefined();
  });

  // NativeWind gives a Text with a non-group `active:`/`hover:`/`focus:` class its own onPress.
  it.each(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const)(
    'the %s label has no self-interaction or box classes',
    (variant) => {
      const classes = buttonTextVariants({ variant }).split(/\s+/);
      for (const c of classes) {
        expect(c).not.toMatch(/^(active|hover|focus):/);
        expect(c).not.toMatch(/^(bg-|min-h-|px-|py-|shadow)/);
      }
    }
  );

  it('no component feeds a className into the label classes', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (entry.name.endsWith('.tsx')) {
          const src = fs.readFileSync(full, 'utf8');
          if (/buttonTextVariants\(\{[^}]*className/.test(src)) offenders.push(full);
          // Destructive look goes through `variant`, not pressable classes on the action.
          if (
            /<AlertDialogAction[^>]*className=\{?[^>]*(buttonVariants|bg-destructive)/.test(src)
          ) {
            offenders.push(full);
          }
        }
      }
    };
    walk(path.join(__dirname, '..', '..', '..'));
    expect(offenders).toEqual([]);
  });
});

// QA (user guide run): "Yes, it’s back" showed as "Yes, it’s" and "Add to Main shelf" as
// "Add to Main" on Android. A label that is a stretched button's only content fills the button.
// Re-test (reading feature): growing the label of a button sized by its label made "Ask" next to
// a wishlist book row take the whole row, so only stretched buttons grow their label.
const classes = (...args: Parameters<typeof buttonLabelClass>) =>
  buttonLabelClass(...args).split(/\s+/);

describe('lone button labels fill a stretched button', () => {
  const label = React.createElement(Text, null, 'Yes, it’s back');
  const icon = React.createElement(View);

  it('grows a label that is the only child of a stretched button, ignoring null and false', () => {
    expect(classes('default', 'default', label, true)).toContain('grow');
    expect(classes('default', 'lg', [null, label, false], true)).toContain('grow');
  });

  it('never grows the label of a button sized by its label', () => {
    expect(classes('default', 'sm', label)).not.toContain('grow');
    expect(classes('secondary', 'sm', label, false)).not.toContain('grow');
  });

  it('leaves a label next to an icon at its own width', () => {
    expect(classes('default', 'default', [icon, label], true)).not.toContain('grow');
    expect(classes('default', 'default', () => label, true)).not.toContain('grow');
  });
});

// A button stretched by `flex-1`, `w-full` or `self-stretch` lets its lone label fill it. The
// regex once read a literal `s` where whitespace was meant, so only a bare class or one at the end
// of the string counted, and "flex-1 gap-2" kept the clipping label.
describe('stretched-button classes', () => {
  it.each([
    'flex-1',
    'w-full',
    'self-stretch',
    'flex-1 gap-2',
    'w-full mt-2',
    'mt-2 w-full gap-2',
    'mt-2 self-stretch',
    'mt-2\nflex-1',
  ])('"%s" stretches the button', (className) => {
    expect(FILL_CLASS.test(className)).toBe(true);
  });

  it.each(['', 'flex-10', 'max-w-full', 'min-w-full gap-2', 'mt-2 self-stretched', 'sm:w-full'])(
    '"%s" does not',
    (className) => {
      expect(FILL_CLASS.test(className)).toBe(false);
    }
  );
});
