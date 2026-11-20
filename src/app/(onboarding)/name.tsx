import { LogOut, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { signOut } from '@/lib/firebase';
import { LIMITS } from '@/types/model';

export default function NameScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim().replace(/\s+/g, ' ');

  const submit = async () => {
    if (saving) return;
    if (!trimmed) {
      setError('Enter your name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.completeProfile({ name: trimmed });
      // The profile listener flips the auth gate to the next step.
    } catch (e) {
      setError(errorMessage(e, 'Couldn’t save your name. Please try again.'));
      setSaving(false);
    }
  };

  return (
    <AuthShell
      icon={UserRound}
      title="What’s your name?"
      description="This is how people who haven’t saved your number see you. Friends who have your number see the name they saved."
      step={{ current: 3, total: 4 }}
      back={false}
      footer={
        <>
          <Button size="lg" onPress={submit} disabled={saving || !trimmed}>
            {saving ? <ActivityIndicator size="small" /> : null}
            <Text>{saving ? 'Saving…' : 'Continue'}</Text>
          </Button>
          <Button variant="ghost" size="sm" onPress={() => void signOut()} disabled={saving}>
            <Icon as={LogOut} size={14} className="text-muted-foreground" />
            <Text className="text-muted-foreground">Use a different number</Text>
          </Button>
        </>
      }
    >
      <View className="gap-2">
        <Label nativeID="name-label">Your name</Label>
        <Input
          className="h-12 text-base"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder="e.g. Asha Rao"
          autoFocus
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={LIMITS.profileName}
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!saving}
          aria-labelledby="name-label"
          aria-invalid={!!error}
        />
        <View className="flex-row justify-between">
          {error ? <Text className="text-sm text-destructive">{error}</Text> : <View />}
          <Text className="text-xs text-muted-foreground">
            {trimmed.length}/{LIMITS.profileName}
          </Text>
        </View>
      </View>
    </AuthShell>
  );
}
