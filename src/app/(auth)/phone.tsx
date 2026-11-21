import { router } from 'expo-router';
import { BookHeart } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { PhoneInput } from '@/components/phone-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/errors';
import { startPhoneSignIn } from '@/lib/firebase';
import { normalisePhone, type CountryCode } from '@/lib/phone';
import { usePhoneAuthStore } from '@/stores/phone-auth';

export default function PhoneScreen() {
  const [country, setCountry] = useState<CountryCode>('IN');
  const [number, setNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const e164 = normalisePhone(number, country);

  const submit = async () => {
    if (sending) return;
    if (!e164) {
      setError('Enter a valid mobile number.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const pending = await startPhoneSignIn(e164);
      usePhoneAuthStore.getState().setPending(e164, pending);
      router.push('/code');
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t send the code. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      icon={BookHeart}
      title="Welcome to LendShelf"
      description="Share books with friends and family. Sign in with your phone number. We’ll text you a 6-digit code."
      step={{ current: 1, total: 4 }}
      back={false}
      footer={
        <>
          <Button size="lg" onPress={submit} disabled={sending || !number.trim()}>
            {sending ? <ActivityIndicator size="small" /> : null}
            <Text>{sending ? 'Sending code…' : 'Send code'}</Text>
          </Button>
          <Text className="text-center text-xs leading-4 text-muted-foreground">
            People who have your number saved will be able to see the books you share.
          </Text>
        </>
      }
    >
      <View className="gap-2">
        <Label nativeID="phone-label">Mobile number</Label>
        <PhoneInput
          country={country}
          onCountryChange={(c) => {
            setCountry(c);
            setError(null);
          }}
          value={number}
          onChangeText={(t) => {
            setNumber(t);
            setError(null);
          }}
          onSubmitEditing={submit}
          autoFocus
          editable={!sending}
          invalid={!!error}
        />
        {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      </View>
    </AuthShell>
  );
}
