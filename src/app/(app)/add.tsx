import { ScanBarcode } from 'lucide-react-native';

import { ComingSoon } from '@/components/coming-soon';

/** Add a book: Search · Scan · Manual, then collection/visibility/format/language (SPEC §6). Stub. */
export default function AddScreen() {
  return (
    <ComingSoon
      title="Add a book"
      icon={ScanBarcode}
      description="Search the catalogue, scan ISBN barcodes, or add a book by hand."
    />
  );
}
