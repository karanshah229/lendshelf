import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator } from 'react-native';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export interface ConfirmButtonProps {
  label: string;
  icon?: LucideIcon;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
  disabled?: boolean;
  busy?: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm(): void;
}

/** A button that asks for confirmation in an AlertDialog before running `onConfirm`. */
export function ConfirmButton({
  label,
  icon,
  variant = 'outline',
  size = 'sm',
  className,
  disabled,
  busy,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={disabled || busy}>
          {busy ? <ActivityIndicator size="small" /> : icon ? <Icon as={icon} size={15} /> : null}
          <Text>{label}</Text>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Text>Not now</Text>
          </AlertDialogCancel>
          <AlertDialogAction onPress={onConfirm} variant={destructive ? 'destructive' : 'default'}>
            <Text>{confirmLabel}</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
