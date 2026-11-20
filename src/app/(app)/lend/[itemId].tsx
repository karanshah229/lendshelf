import { HandHelping } from 'lucide-react-native';

import { ComingSoon } from '@/components/coming-soon';

/** Lend a copy: pick an app contact, any phone contact or type a name/number; due date (SPEC §6). Stub. */
export default function LendScreen() {
  return (
    <ComingSoon
      title="Lend"
      icon={HandHelping}
      description="Lend this copy to anyone, on the app or not."
    />
  );
}
