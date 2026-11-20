import { HttpsError } from "firebase-functions/v2/https";
import type { z } from "zod";

export { HttpsError };

/** Parse callable input with a zod schema; failures become `invalid-argument`. */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const issues = r.error.issues
      .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
      .join("; ");
    throw new HttpsError("invalid-argument", `Invalid request: ${issues}`);
  }
  return r.data;
}

export function notFound(what: string): HttpsError {
  return new HttpsError("not-found", `${what} not found.`);
}

export function denied(message: string): HttpsError {
  return new HttpsError("permission-denied", message);
}

export function precondition(message: string): HttpsError {
  return new HttpsError("failed-precondition", message);
}
