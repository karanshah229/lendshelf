/**
 * A BulkWriter wrapper that keeps every operation's promise, so callers can
 * tell whether all writes landed. (BulkWriter.close() resolves even when
 * individual writes failed; the failures only show up on those promises.)
 */
import type { BulkWriter, DocumentData, DocumentReference, Firestore, Precondition } from "firebase-admin/firestore";

export interface BulkFailure {
  path: string;
  error: unknown;
}

export interface TrackedWriter {
  set(ref: DocumentReference, data: DocumentData): Promise<unknown>;
  update(ref: DocumentReference, data: DocumentData, precondition?: Precondition): Promise<unknown>;
  delete(ref: DocumentReference): Promise<unknown>;
  /** Flush everything; resolves with the writes that failed (after BulkWriter's retries). */
  close(): Promise<BulkFailure[]>;
}

/** gRPC FAILED_PRECONDITION: a precondition (e.g. lastUpdateTime) didn't hold; retrying won't help. */
const FAILED_PRECONDITION = 9;

/** Retries each failed write up to 3 attempts in total (not failed preconditions). */
export function trackedBulkWriter(db: Pick<Firestore, "bulkWriter">): TrackedWriter {
  const writer: BulkWriter = db.bulkWriter();
  writer.onWriteError((err) => Number(err.code) !== FAILED_PRECONDITION && err.failedAttempts < 3);
  const ops: { path: string; p: Promise<unknown> }[] = [];
  const track = (path: string, p: Promise<unknown>): Promise<unknown> => {
    // Mark as handled now; failures are collected in close().
    p.catch(() => undefined);
    ops.push({ path, p });
    return p;
  };
  return {
    set: (ref, data) => track(ref.path, writer.set(ref, data)),
    update: (ref, data, precondition) =>
      track(ref.path, precondition ? writer.update(ref, data, precondition) : writer.update(ref, data)),
    delete: (ref) => track(ref.path, writer.delete(ref)),
    async close() {
      await writer.close();
      const results = await Promise.allSettled(ops.map((o) => o.p));
      const failures: BulkFailure[] = [];
      results.forEach((r, i) => {
        if (r.status === "rejected") failures.push({ path: ops[i]!.path, error: r.reason });
      });
      return failures;
    },
  };
}
