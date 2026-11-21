import { Bell } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

import { acceptPushAsk } from './ask';
import { usePushAskStore } from './store';

/**
 * The in-context notification pre-prompt (C11): one line on why, then the system dialog on
 * "Turn on notifications". On Android ≤ 12 it's the one-time line about what will be sent, with
 * OK. Mount once in the signed-in layout; `askForPushInContext()` opens it.
 */
export function PushAskDialog() {
  const pending = usePushAskStore((s) => s.pending);
  const close = () => usePushAskStore.getState().close();

  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && close()}>
      {pending ? (
        <DialogContent className="w-[22rem] max-w-full">
          <DialogHeader className="items-center">
            <View className="size-12 items-center justify-center rounded-full bg-muted">
              <Icon as={Bell} size={22} className="text-muted-foreground" />
            </View>
            <DialogTitle className="text-center">{pending.copy.title}</DialogTitle>
            <DialogDescription className="text-center">{pending.copy.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              size="lg"
              onPress={() => {
                const { uid, decision } = pending;
                close();
                if (decision === 'prePrompt') void acceptPushAsk(uid);
              }}
            >
              <Text>{pending.copy.confirm}</Text>
            </Button>
            {pending.copy.cancel ? (
              <Button size="lg" variant="outline" onPress={close}>
                <Text>{pending.copy.cancel}</Text>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
