import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

const textVariants = cva(
  cn(
    'text-foreground text-base',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: '',
        h1: cn(
          'text-center text-4xl font-extrabold tracking-tight',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'border-border border-b pb-2 text-3xl font-semibold tracking-tight',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn('text-2xl font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        h4: cn('text-xl font-semibold tracking-tight', Platform.select({ web: 'scroll-m-20' })),
        p: 'mt-3 leading-7 sm:mt-6',
        blockquote: 'mt-4 border-l-2 pl-3 italic sm:mt-6 sm:pl-6',
        code: cn(
          'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold'
        ),
        lead: 'text-muted-foreground text-xl',
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium leading-none',
        muted: 'text-muted-foreground text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

/**
 * True inside a pressable container (Button, AlertDialogAction, Toggle, …). A label there must
 * never become the touch target itself: on native, NativeWind gives a Text with an `active:`,
 * `hover:` or `focus:` class its own `onPress`, so the Text answers the touch and the parent's
 * `onPress` never fires. Web already does this with `pointer-events-none` on button text.
 */
const PressableLabelContext = React.createContext(false);

function Text({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const insidePressable = React.useContext(PressableLabelContext);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(textVariants({ variant }), textClass, className)}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      pointerEvents={labelPointerEvents(insidePressable, props)}
      {...props}
    />
  );
}

/** A label inside a pressable lets touches through to it, unless it is pressable itself. */
function labelPointerEvents(
  insidePressable: boolean,
  props: { onPress?: unknown; onLongPress?: unknown }
): 'none' | undefined {
  return insidePressable && props.onPress == null && props.onLongPress == null
    ? 'none'
    : undefined;
}

/** Marks its children as the label of a pressable (see `PressableLabelContext`). */
function PressableLabel({ children }: { children: React.ReactNode }) {
  return <PressableLabelContext.Provider value={true}>{children}</PressableLabelContext.Provider>;
}

export { labelPointerEvents, PressableLabel, PressableLabelContext, Text, TextClassContext };
