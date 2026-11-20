import { useDocData } from '@/hooks/use-firestore';
import { COLLECTIONS, type Work } from '@/types/model';

/** A Book (`works/{workId}`), live. */
export function useWork(workId: string | null | undefined) {
  const res = useDocData<Work>(workId ? `${COLLECTIONS.works}/${workId}` : null);
  return { work: res.data, loading: res.loading, error: res.error };
}
