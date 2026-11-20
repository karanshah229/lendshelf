import { Bell, BellOff } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Row, SectionLabel } from '@/features/me/rows';
import {
  getPushPermission,
  openNotificationSettings,
  PUSH_SUPPORTED,
  registerForPush,
  type PushPermission,
} from '@/lib/push';
import { useSessionStore } from '@/stores/session';

const DETAIL: Record<PushPermission, string> = {
  granted: 'Requests, returns and due-date reminders',
  denied: 'Turned off in system settings. Tap to open them.',
  undetermined: 'Get told about requests and due dates',
  unsupported: 'Not available on this device',
};

/** "Notifications" section: push status with a way to turn them on. Hidden on web. */
export function NotificationsSection() {
  const uid = useSessionStore((s) => s.user?.uid);
  const [permission, setPermission] = useState<PushPermission | null>(null);

  const refresh = useCallback(() => {
    if (PUSH_SUPPORTED) void getPushPermission().then(setPermission);
  }, []);

  useEffect(() => {
    refresh();
    // Re-check when coming back from the system settings.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!PUSH_SUPPORTED || permission === null) return null;

  const onPress =
    permission === 'denied'
      ? openNotificationSettings
      : permission === 'undetermined' && uid
        ? () => void registerForPush(uid).then(setPermission)
        : undefined;

  return (
    <>
      <SectionLabel>Notifications</SectionLabel>
      <Card className="gap-0 py-0">
        <Row
          icon={permission === 'granted' ? Bell : BellOff}
          label="Push notifications"
          detail={DETAIL[permission]}
          onPress={onPress}
          right={
            permission === 'granted' ? (
              <Badge variant="success">
                <Text>On</Text>
              </Badge>
            ) : undefined
          }
        />
      </Card>
    </>
  );
}
