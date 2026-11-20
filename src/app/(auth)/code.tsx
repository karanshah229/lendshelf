import { Redirect, router } from 'expo-router';
import { MessageSquareText, Wand2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { OtpInput } from '@/components/otp-input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/errors';
import { emulatorVerificationCodesUrl, startPhoneSignIn, USE_EMULATORS } from '@/lib/firebase';
import { formatPhone } from '@/lib/phone';
import { toast } from '@/lib/toast';
import { usePhoneAuthStore } from '@/stores/phone-auth';

const CODE_LENGTH = 6;
const RESEND_AFTER_S = 30;

/** Reads the latest code the Auth emulator "sent" to `phone`. */
async function fetchEmulatorCode(phone: string): Promise<string | null> {
  const res = await fetch(emulatorVerificationCodesUrl());
  if (!res.ok) throw new Error(`Auth emulator returned ${res.status}`);
  const body = (await res.json()) as {
    verificationCodes?: { phoneNumber: string; code: string }[];
  };
  const matches = (body.verificationCodes ?? []).filter((c) => c.phoneNumber === phone);
  return matches.at(-1)?.code ?? null;
}

export default function CodeScreen() {
  const phone = usePhoneAuthStore((s) => s.phone);
  const pending = usePhoneAuthStore((s) => s.pending);
  const sentAt = usePhoneAuthStore((s) => s.sentAt);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [fetchingCode, setFetchingCode] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const verify = useCallback(
    async (value: string) => {
      if (!pending || verifying) return;
      setVerifying(true);
      setError(null);
      try {
        await pending.confirm(value);
        usePhoneAuthStore.getState().clear();
        // The auth gate moves on to the name step (or the app) automatically.
      } catch (e) {
        setError(errorMessage(e, 'That code didn’t work. Please try again.'));
        setCode('');
      } finally {
        setVerifying(false);
      }
    },
    [pending, verifying]
  );

  if (!phone || !pending) return <Redirect href="/phone" />;

  const secondsLeft = Math.max(0, RESEND_AFTER_S - Math.floor((now - (sentAt ?? 0)) / 1000));

  const resend = async () => {
    setResending(true);
    setError(null);
    try {
      const next = await startPhoneSignIn(phone);
      usePhoneAuthStore.getState().setPending(phone, next);
      setCode('');
      toast.success('New code sent');
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t resend the code.'));
    } finally {
      setResending(false);
    }
  };

  const fillFromEmulator = async () => {
    setFetchingCode(true);
    try {
      const found = await fetchEmulatorCode(phone);
      if (!found) {
        toast.error('No code found for this number yet');
        return;
      }
      setCode(found);
      void verify(found);
    } catch {
      toast.error('Couldn’t reach the Auth emulator');
    } finally {
      setFetchingCode(false);
    }
  };

  return (
    <AuthShell
      icon={MessageSquareText}
      title="Enter the code"
      description={
        <Text className="text-base leading-6 text-muted-foreground">
          We sent a 6-digit code to{' '}
          <Text className="font-medium text-foreground">{formatPhone(phone)}</Text>.
        </Text>
      }
      step={{ current: 2, total: 4 }}
      back={() => {
        usePhoneAuthStore.getState().clear();
        if (router.canGoBack()) router.back();
        else router.replace('/phone');
      }}
      footer={
        <>
          <Button
            size="lg"
            onPress={() => verify(code)}
            disabled={verifying || code.length < CODE_LENGTH}
          >
            {verifying ? <ActivityIndicator size="small" /> : null}
            <Text>{verifying ? 'Verifying…' : 'Verify'}</Text>
          </Button>
          <Button variant="ghost" onPress={resend} disabled={secondsLeft > 0 || resending}>
            <Text>
              {secondsLeft > 0
                ? `Resend code in ${secondsLeft}s`
                : resending
                  ? 'Sending…'
                  : 'Resend code'}
            </Text>
          </Button>
        </>
      }
    >
      <OtpInput
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setError(null);
        }}
        onComplete={verify}
        length={CODE_LENGTH}
        autoFocus
        editable={!verifying}
        invalid={!!error}
      />
      {error ? <Text className="text-sm text-destructive">{error}</Text> : null}
      {USE_EMULATORS ? (
        <View className="gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-4">
          <Text className="text-sm text-muted-foreground">
            Running against the Firebase emulators — no SMS is sent.
          </Text>
          <Button variant="outline" onPress={fillFromEmulator} disabled={fetchingCode || verifying}>
            <Icon as={Wand2} size={16} />
            <Text>{fetchingCode ? 'Fetching…' : 'Use code from emulator'}</Text>
          </Button>
        </View>
      ) : null}
    </AuthShell>
  );
}
