import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { resolveBook as resolve, type BookStore, type ResolveBookResult } from "../lib/books.js";
import { ts, type Caller, type Deps } from "../lib/context.js";
import { HttpsError, parseInput } from "../lib/errors.js";
import { COL, type IsbnIndexDoc, type WorkData, type WorkDoc } from "../model.js";

const isbnField = z.string().trim().min(10).max(20);

export const resolveBookSchema = z.union([
  z.object({ olWorkKey: z.string().trim().min(3).max(40), isbn: isbnField.optional() }).strict(),
  z.object({ gbVolumeId: z.string().trim().min(4).max(40), isbn: isbnField.optional() }).strict(),
  z.object({ isbn: isbnField }).strict(),
]);

function stripTimestamps(doc: WorkDoc): WorkData {
  const { createdAt: _c, updatedAt: _u, ...rest } = doc;
  return rest;
}

/** Firestore-backed store for book resolution. */
export function firestoreBookStore(db: Firestore, now: () => Date): BookStore {
  return {
    async getIsbn(isbn13) {
      const s = await db.collection(COL.isbnIndex).doc(isbn13).get();
      return s.exists ? (s.data() as IsbnIndexDoc) : null;
    },
    async setIsbn(isbn13, doc) {
      await db.collection(COL.isbnIndex).doc(isbn13).set(doc);
    },
    async getWork(workId) {
      const s = await db.collection(COL.works).doc(workId).get();
      return s.exists ? stripTimestamps(s.data() as WorkDoc) : null;
    },
    async createWork(workId, work) {
      const ref = db.collection(COL.works).doc(workId);
      return db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (s.exists) return stripTimestamps(s.data() as WorkDoc);
        const t = ts(now());
        const doc: WorkDoc = { ...work, createdAt: t, updatedAt: t };
        tx.set(ref, doc);
        return work;
      });
    },
    async fillWorkCover(workId, coverUrl) {
      const ref = db.collection(COL.works).doc(workId);
      return db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) return null;
        const stored = stripTimestamps(s.data() as WorkDoc);
        if (stored.coverUrl) return stored;
        tx.update(ref, { coverUrl, updatedAt: ts(now()) });
        return { ...stored, coverUrl };
      });
    },
  };
}

export async function resolveBook(deps: Deps, _caller: Caller, data: unknown): Promise<ResolveBookResult> {
  const input = parseInput(resolveBookSchema, data);
  try {
    return await resolve(input, { store: firestoreBookStore(deps.db, deps.now), fetch: deps.fetch });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", "Looking up the book failed. Please try again.");
  }
}
