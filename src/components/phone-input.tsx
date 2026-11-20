import { getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { useMemo } from 'react';
import { View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Countries offered in the picker (India first). Any number typed with "+" also works. */
export const COUNTRIES: { code: CountryCode; name: string; flag: string }[] = [
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
];

export interface PhoneInputProps {
  country: CountryCode;
  onCountryChange(country: CountryCode): void;
  value: string;
  onChangeText(value: string): void;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  autoFocus?: boolean;
  editable?: boolean;
  invalid?: boolean;
  className?: string;
}

/** Country calling-code picker + national number field. */
export function PhoneInput({
  country,
  onCountryChange,
  value,
  onChangeText,
  onSubmitEditing,
  autoFocus,
  editable = true,
  invalid,
  className,
}: PhoneInputProps) {
  const insets = useSafeAreaInsets();
  const options = useMemo(
    () =>
      COUNTRIES.map((c) => ({
        value: c.code,
        label: `${c.flag} +${getCountryCallingCode(c.code)}`,
        name: c.name,
      })),
    []
  );
  const selected = options.find((o) => o.value === country) ?? options[0]!;

  return (
    <View className={cn('flex-row gap-2', className)}>
      <Select
        value={{ value: selected.value, label: selected.label }}
        onValueChange={(opt) => opt && onCountryChange(opt.value as CountryCode)}
        disabled={!editable}
      >
        <SelectTrigger className="h-12 w-28" aria-label="Country code">
          {/* Short label in the trigger; the list shows full country names. */}
          <Text className="text-base">{selected.label}</Text>
        </SelectTrigger>
        <SelectContent
          insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}
          className="w-64"
        >
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} label={`${o.label}  ${o.name}`}>
                {o.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Input
        className="h-12 flex-1 text-base"
        value={value}
        onChangeText={onChangeText}
        placeholder="98765 43210"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus={autoFocus}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="next"
        aria-invalid={invalid}
        accessibilityLabel="Phone number"
      />
    </View>
  );
}
