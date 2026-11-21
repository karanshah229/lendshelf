/**
 * Home's one-line status strip (UX §D4): "2 out with friends · 1 with you, due 12 Dec ›" → Loans.
 * Only when I have open loans; wraps to two lines at large font sizes (F8).
 */
import { router } from 'expo-router';
import { ArrowLeftRight, ChevronRight } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { statusStripText } from '@/features/home/home';
import { cn } from '@/lib/utils';
import type { Loan } from '@/types/model';

export function StatusStrip({
  outWithFriends,
  withYou,
  now,
  className,
}: {
  outWithFriends: readonly Pick<Loan, 'status' | 'dueDate'>[];
  withYou: readonly Pick<Loan, 'status' | 'dueDate'>[];
  now: Date;
  className?: string;
}) {
  const text = statusStripText(outWithFriends, withYou, now);
  if (!text) return null;
  return (
    <Pressable
      onPress={() => router.navigate('/loans')}
      accessibilityRole="link"
      accessibilityLabel={`${text}. Opens Loans`}
      // 40 dp strip, 48 dp touch target (F8).
      hitSlop={{ top: 4, bottom: 4 }}
      className={cn(
        'min-h-10 flex-row items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 active:bg-accent',
        className
      )}
    >
      <Icon as={ArrowLeftRight} size={14} className="text-muted-foreground" />
      <Text className="flex-1 text-sm">{text}</Text>
      <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
    </Pressable>
  );
}
