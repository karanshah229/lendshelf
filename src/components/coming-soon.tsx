import type { LucideIcon } from 'lucide-react-native';
import { Hammer } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';

/** Placeholder for routes whose screens are not built yet. */
export function ComingSoon({
  title,
  description,
  icon = Hammer,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <Screen header={<ScreenHeader title={title} />}>
      <EmptyState
        icon={icon}
        title={title}
        description={description ?? 'This screen is coming soon.'}
      >
        {children}
      </EmptyState>
    </Screen>
  );
}
