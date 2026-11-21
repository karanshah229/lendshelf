import * as fs from 'fs';
import * as path from 'path';

import { buttonTextVariants } from '@/components/ui/button';
import { labelPointerEvents } from '@/components/ui/text';

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
