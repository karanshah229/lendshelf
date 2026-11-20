import { FolderCog } from 'lucide-react-native';

import { ComingSoon } from '@/components/coming-soon';
import { Text } from '@/components/ui/text';
import { useMyShelves } from '@/hooks/use-shelves';

/** Collections: create, rename, reorder, public/private, delete (SPEC §6). Stub. */
export default function ShelvesScreen() {
  const { shelves } = useMyShelves();
  return (
    <ComingSoon
      title="Collections"
      icon={FolderCog}
      description="Create, rename, reorder and choose who sees each collection."
    >
      {shelves.map((s) => (
        <Text key={s.id} className="text-center text-sm">
          {s.name} · {s.isPublic ? 'Public' : 'Private'}
        </Text>
      ))}
    </ComingSoon>
  );
}
