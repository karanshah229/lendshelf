import { useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export interface OtpInputProps {
  value: string;
  onChangeText(value: string): void;
  /** Called once all digits are entered. */
  onComplete?(value: string): void;
  length?: number;
  autoFocus?: boolean;
  editable?: boolean;
  invalid?: boolean;
}

/**
 * One-time-code input: a row of digit boxes backed by a single hidden TextInput, so paste,
 * SMS autofill (iOS `oneTimeCode`, Android `sms-otp`) and backspace all work naturally.
 */
export function OtpInput({
  value,
  onChangeText,
  onComplete,
  length = 6,
  autoFocus,
  editable = true,
  invalid,
}: OtpInputProps) {
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChangeText(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      className="relative"
    >
      <View className="flex-row justify-between gap-2">
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? '';
          const isActive = focused && editable && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              className={cn(
                'h-14 flex-1 items-center justify-center rounded-md border border-input bg-background shadow-sm shadow-black/5 dark:bg-input/30',
                isActive && 'border-2 border-ring ring-ring/50',
                invalid && 'border-destructive',
                !editable && 'opacity-50'
              )}
            >
              <Text className="text-2xl font-semibold">{char}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        accessibilityLabel={`${length}-digit code`}
        // Covers the boxes so taps focus it, but stays invisible.
        className="absolute inset-0 opacity-0"
        style={
          Platform.OS === 'web'
            ? ({ outlineStyle: 'none', color: 'transparent' } as object)
            : undefined
        }
      />
    </Pressable>
  );
}
