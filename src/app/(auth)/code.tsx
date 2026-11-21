import { Redirect, router } from 'expo-router';
import { MessageSquareText } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { OtpInput } from '@/components/otp-input';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { errorMessage } from '@/lib/errors';
import { startPhoneSignIn } from '@/lib/firebase';
import { formatPhone } from '@/lib/phone';
import { toast } from '@/lib/toast';
import { usePhoneAuthStore } from '@/stores/phone-auth';

const CODE_LENGTH = 6;
const RESEND_AFTER_S = 30;

export default function CodeScreen() {
  const phone = usePhoneAuthStore((s) => s.phone);
  const pending = usePhoneAuthStore((s) => s.pending);
  const sentAt = usePhoneAuthStore((s) => s.sentAt);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
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
    </AuthShell>
  );
}
