import { PressableLabel, Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Pressable, type Insets } from 'react-native';

const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-md shadow-none',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-primary active:bg-primary/90 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-primary/90' })
        ),
        destructive: cn(
          'bg-destructive active:bg-destructive/90 dark:bg-destructive/60 shadow-sm shadow-black/5',
          Platform.select({
            web: 'hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
          })
        ),
        outline: cn(
          'border-border bg-background active:bg-accent dark:bg-input/30 dark:border-input dark:active:bg-input/50 border shadow-sm shadow-black/5',
          Platform.select({
            web: 'hover:bg-accent dark:hover:bg-input/50',
          })
        ),
        secondary: cn(
          'bg-secondary active:bg-secondary/80 shadow-sm shadow-black/5',
          Platform.select({ web: 'hover:bg-secondary/80' })
        ),
        ghost: cn(
          'active:bg-accent dark:active:bg-accent/50',
          Platform.select({ web: 'hover:bg-accent dark:hover:bg-accent/50' })
        ),
        link: '',
      },
      size: {
        // min-h, not h: labels wrap and the button grows at 200 % font (UX §F8).
        default: cn('min-h-10 px-4 py-2 sm:min-h-9', Platform.select({ web: 'has-[>svg]:px-3' })),
        sm: cn(
          'min-h-9 gap-1.5 rounded-md px-3 py-1 sm:min-h-8',
          Platform.select({ web: 'has-[>svg]:px-2.5' })
        ),
        lg: cn(
          'min-h-11 rounded-md px-6 py-2 sm:min-h-10',
          Platform.select({ web: 'has-[>svg]:px-4' })
        ),
        icon: 'h-10 w-10 sm:h-9 sm:w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  cn(
    // `shrink` + centred: a long label wraps inside the button instead of overflowing it (F8).
    'text-foreground shrink text-center text-sm font-medium',
    Platform.select({ web: 'pointer-events-none transition-colors' })
  ),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-white',
        outline: cn(
          'group-active:text-accent-foreground',
          Platform.select({ web: 'group-hover:text-accent-foreground' })
        ),
        secondary: 'text-secondary-foreground',
        ghost: 'group-active:text-accent-foreground',
        link: cn(
          'text-primary group-active:underline',
          Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })
        ),
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/**
 * Label classes for a pressable. In a button whose width is set from outside (`fill`: full
 * width or `flex-1`), a label that is its only content also grows to fill it: on Android a
 * centred label can be laid out a fraction of a pixel narrower than it measured, so its last word
 * wraps onto a second line that has no room and vanishes ("Yes, it’s" for "Yes, it’s back").
 * Filling the width leaves room to spare; `text-center` keeps it centred.
 * Never in a button sized by its label: a growing label makes such a button take all the space
 * it is offered ("Ask" next to a book row covered the row). Labels next to an icon keep their
 * own width so the icon stays beside the text.
 */
function buttonLabelClass(
  variant: VariantProps<typeof buttonTextVariants>['variant'],
  size: VariantProps<typeof buttonTextVariants>['size'],
  children: unknown,
  fill = false
): string {
  return cn(buttonTextVariants({ variant, size }), fill && isLoneLabel(children) && 'grow');
}

/** Width classes that mean the button's width comes from outside, not from its label. */
const FILL_CLASS = /(^|\s)(flex-1|w-full|self-stretch)(\s|$)/;

/** True when the only child (ignoring null and false) is a `Text`. */
function isLoneLabel(children: unknown): boolean {
  if (typeof children === 'function') return false;
  const kids = React.Children.toArray(children as React.ReactNode);
  return kids.length === 1 && React.isValidElement(kids[0]) && kids[0].type === Text;
}

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    /**
     * The button is stretched by its parent (e.g. full width in a column), so a lone label may
     * fill it (see `buttonLabelClass`). Implied by `flex-1`, `w-full` or `self-stretch`.
     */
    fillLabel?: boolean;
  };

/**
 * Extra hit area so every button reaches a 48 dp touch target (UX §F8) while keeping its visual
 * size. A `hitSlop` prop overrides it.
 */
const HIT_SLOP: Record<NonNullable<ButtonProps['size']>, Insets> = {
  default: { top: 4, bottom: 4, left: 4, right: 4 },
  sm: { top: 6, bottom: 6, left: 4, right: 4 },
  lg: { top: 2, bottom: 2 },
  icon: { top: 4, bottom: 4, left: 4, right: 4 },
};

function Button({ className, variant, size, fillLabel, ...props }: ButtonProps) {
  const fill = fillLabel ?? FILL_CLASS.test(className ?? '');
  return (
    <TextClassContext.Provider value={buttonLabelClass(variant, size, props.children, fill)}>
      <PressableLabel>
        <Pressable
          className={cn(
            props.disabled && 'opacity-50',
            buttonVariants({ variant, size }),
            className
          )}
          role="button"
          hitSlop={HIT_SLOP[size ?? 'default']}
          {...props}
        />
      </PressableLabel>
    </TextClassContext.Provider>
  );
}

export { Button, buttonLabelClass, buttonTextVariants, buttonVariants, FILL_CLASS };
export type { ButtonProps };
