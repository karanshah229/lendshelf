/**
 * One vocabulary for who can see a copy (UX F6 / E9), shared by the copy page's Sharing control
 * and the Add confirm step.
 */
import type { Visibility } from '@/types/model';

export const VISIBILITY_COPY: Record<Visibility, { label: string; help: string }> = {
  lendable: {
    label: 'Lendable',
    help: 'People who have your number saved can see it and ask to borrow it.',
  },
  visible: {
    label: 'Not lending',
    help: 'People who have your number saved can see you have it, but can’t ask.',
  },
  hidden: { label: 'Hidden', help: 'Only you can see it.' },
};
