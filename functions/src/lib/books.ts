/**
 * Book lookup: Open Library first, Google Books as fallback.
 *
 * Network access goes through an injected `fetch`, and persistence through an
 * injected `BookStore`, so the whole resolution flow is unit-testable.
 */
import { HttpsError } from "./errors.js";
import { normaliseIsbn } from "./isbn.js";
import { gbWorkId, olWorkId, type EditionInfo, type IsbnIndexDoc, type WorkData } from "../model.js";

export const USER_AGENT = "LendShelf/0.1";
export const OL_BASE = "https://openlibrary.org";
export const GB_BASE = "https://www.googleapis.com/books/v1/volumes";

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponseLike>;

/** Thrown for network failures / 5xx responses (as opposed to "not found"). */
export class BookSourceError extends Error {}

/** Fetch JSON. Returns null on 404; throws BookSourceError on other failures. */
export async function getJson(fetchImpl: FetchLike, url: string): Promise<unknown | null> {
  let res: FetchResponseLike;
  try {
    res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  } catch (err) {
    throw new BookSourceError(`Request to ${url} failed: ${String(err)}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new BookSourceError(`Request to ${url} returned HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new BookSourceError(`Response from ${url} was not JSON`);
  }
}

// ---- small parsers ----------------------------------------------------------

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

export function olCoverUrl(id: unknown): string | null {
  return typeof id === "number" && Number.isInteger(id) && id > 0
    ? `https://covers.openlibrary.org/b/id/${id}-L.jpg`
    : null;
}

function firstCover(covers: unknown): string | null {
  if (!Array.isArray(covers)) return null;
  for (const c of covers) {
    const url = olCoverUrl(c);
    if (url) return url;
  }
  return null;
}

/** "OL45804W" from "OL45804W", "/works/OL45804W" or "works/OL45804W"; else null. */
export function normaliseOlWorkKey(key: string): string | null {
  const m = /^(?:\/?works\/)?(OL\d+W)$/i.exec(key.trim());
  return m ? (m[1] as string).toUpperCase() : null;
}

export function normaliseOlAuthorKey(key: string): string | null {
  const m = /^(?:\/?authors\/)?(OL\d+A)$/i.exec(key.trim());
  return m ? (m[1] as string).toUpperCase() : null;
}

export function isValidGbVolumeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{4,24}$/.test(id);
}

/** First plausible 4-digit year in a free-text date ("May 04, 2021" -> 2021). */
export function parseYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0 && value < 3000) return value;
  if (typeof value !== "string") return null;
  const m = /\b(1[0-9]{3}|20[0-9]{2})\b/.exec(value);
  return m ? Number(m[1]) : null;
}

/** Open Library descriptions are either a string or `{ type, value }`. */
export function olDescription(value: unknown): string | null {
  if (typeof value === "string") return str(value);
  if (isObj(value)) return str(value.value);
  return null;
}

const LANG_3_TO_2: Record<string, string> = {
  eng: "en", hin: "hi", mar: "mr", tam: "ta", tel: "te", kan: "kn", mal: "ml", ben: "bn",
  guj: "gu", pan: "pa", urd: "ur", ori: "or", asm: "as", san: "sa", fre: "fr", fra: "fr",
  ger: "de", deu: "de", spa: "es", por: "pt", ita: "it", jpn: "ja", chi: "zh", zho: "zh",
  rus: "ru", ara: "ar", dut: "nl", nld: "nl", kor: "ko",
};

/** "/languages/eng" -> "en"; "en" -> "en"; unknown 3-letter codes are kept. */
export function languageCode(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  const code = s.replace(/^\/?languages\//, "").toLowerCase();
  if (code === "und" || code === "mul") return null;
  return LANG_3_TO_2[code] ?? code;
}

/** Google Books thumbnails: force https, drop the page-curl effect. */
export function gbCoverUrl(volumeInfo: Json): string | null {
  const links = isObj(volumeInfo.imageLinks) ? volumeInfo.imageLinks : null;
  if (!links) return null;
  const url = str(links.thumbnail) ?? str(links.smallThumbnail);
  if (!url) return null;
  return url.replace(/^http:\/\//, "https://").replace(/&edge=curl/g, "");
}

// ---- Open Library -----------------------------------------------------------

export interface OlEdition {
  workKey: string | null;
  title: string | null;
  authorKeys: string[];
  edition: EditionInfo;
}

export async function fetchOpenLibraryEdition(isbn13: string, fetchImpl: FetchLike): Promise<OlEdition | null> {
  const json = await getJson(fetchImpl, `${OL_BASE}/isbn/${isbn13}.json`);
  if (!isObj(json)) return null;
  const works = Array.isArray(json.works) ? json.works : [];
  const workKeyRaw = isObj(works[0]) ? str(works[0].key) : null;
  const languages = Array.isArray(json.languages) ? json.languages : [];
  const publishers = Array.isArray(json.publishers) ? json.publishers : [];
  const authors = Array.isArray(json.authors) ? json.authors : [];
  return {
    workKey: workKeyRaw ? normaliseOlWorkKey(workKeyRaw) : null,
    title: str(json.title),
    authorKeys: authors
      .map((a) => (isObj(a) ? str(a.key) : null))
      .map((k) => (k ? normaliseOlAuthorKey(k) : null))
      .filter((k): k is string => k !== null),
    edition: {
      isbn: isbn13,
      coverUrl: firstCover(json.covers),
      language: isObj(languages[0]) ? languageCode(languages[0].key) : null,
      publisher: str(publishers[0]),
      publishYear: parseYear(json.publish_date),
    },
  };
}

async function fetchAuthorNames(keys: string[], fetchImpl: FetchLike): Promise<string[]> {
  const names = await Promise.all(
    keys.slice(0, 5).map(async (key) => {
      try {
        const a = await getJson(fetchImpl, `${OL_BASE}/authors/${key}.json`);
        return isObj(a) ? str(a.name) ?? str(a.personal_name) : null;
      } catch {
        return null;
      }
    }),
  );
  return names.filter((n): n is string => n !== null);
}

/** Fetch a work and its author names. Null if Open Library doesn't know the key. */
export async function fetchOpenLibraryWork(workKey: string, fetchImpl: FetchLike): Promise<WorkData | null> {
  const json = await getJson(fetchImpl, `${OL_BASE}/works/${workKey}.json`);
  if (!isObj(json)) return null;
  const title = str(json.title);
  if (!title) return null;
  const authorRefs = Array.isArray(json.authors) ? json.authors : [];
  const authorKeys = authorRefs
    .map((r) => (isObj(r) && isObj(r.author) ? str(r.author.key) : isObj(r) ? str(r.key) : null))
    .map((k) => (k ? normaliseOlAuthorKey(k) : null))
    .filter((k): k is string => k !== null);
  return {
    category: "book",
    source: "openlibrary",
    title,
    authors: await fetchAuthorNames(authorKeys, fetchImpl),
    description: olDescription(json.description),
    coverUrl: firstCover(json.covers),
    firstPublishYear: parseYear(json.first_publish_date),
    isCustom: false,
    createdBy: null,
  };
}

// ---- Google Books -----------------------------------------------------------

export interface GbVolume {
  volumeId: string;
  work: WorkData;
  edition: EditionInfo;
}

function parseGbVolume(item: unknown, isbnHint: string | null): GbVolume | null {
  if (!isObj(item) || !isObj(item.volumeInfo)) return null;
  const id = str(item.id);
  const vi = item.volumeInfo;
  const title = str(vi.title);
  if (!id || !title || !isValidGbVolumeId(id)) return null;
  const subtitle = str(vi.subtitle);
  const ids = Array.isArray(vi.industryIdentifiers) ? vi.industryIdentifiers : [];
  const isbn13 =
    isbnHint ??
    ids
      .map((x) => (isObj(x) && x.type === "ISBN_13" ? str(x.identifier) : null))
      .find((x): x is string => x !== null) ??
    null;
  const cover = gbCoverUrl(vi);
  const year = parseYear(vi.publishedDate);
  return {
    volumeId: id,
    work: {
      category: "book",
      source: "googlebooks",
      title: subtitle ? `${title}: ${subtitle}` : title,
      authors: Array.isArray(vi.authors) ? vi.authors.filter((a): a is string => typeof a === "string") : [],
      description: str(vi.description),
      coverUrl: cover,
      firstPublishYear: year,
      isCustom: false,
      createdBy: null,
    },
    edition: {
      isbn: isbn13 ? normaliseIsbn(isbn13) : null,
      coverUrl: cover,
      language: languageCode(vi.language),
      publisher: str(vi.publisher),
      publishYear: year,
    },
  };
}

export async function fetchGoogleBooksByIsbn(isbn13: string, fetchImpl: FetchLike): Promise<GbVolume | null> {
  const json = await getJson(fetchImpl, `${GB_BASE}?q=isbn:${isbn13}`);
  if (!isObj(json) || !Array.isArray(json.items)) return null;
  for (const item of json.items) {
    const v = parseGbVolume(item, isbn13);
    if (v) return v;
  }
  return null;
}

export async function fetchGoogleBooksVolume(volumeId: string, fetchImpl: FetchLike): Promise<GbVolume | null> {
  const json = await getJson(fetchImpl, `${GB_BASE}/${encodeURIComponent(volumeId)}`);
  return parseGbVolume(json, null);
}

/** True if the text is written in Latin script (plus digits/punctuation). */
export function isLatinText(text: string): boolean {
  return /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u.test(text);
}

/**
 * Open Library work titles are sometimes in the original language
 * ("Преступление и наказание") while the scanned edition is English. When the
 * work title isn't Latin script but the edition title is, use the edition's.
 */
export function preferEditionTitle(workTitle: string, editionTitle: string | null): string {
  if (editionTitle && !isLatinText(workTitle) && isLatinText(editionTitle)) return editionTitle;
  return workTitle;
}

// ---- resolution -------------------------------------------------------------

/** Persistence used by `resolveBook`. Firestore in production, in-memory in tests. */
export interface BookStore {
  getIsbn(isbn13: string): Promise<IsbnIndexDoc | null>;
  setIsbn(isbn13: string, doc: IsbnIndexDoc): Promise<void>;
  getWork(workId: string): Promise<WorkData | null>;
  /** Create the work unless it already exists; returns the stored version. */
  createWork(workId: string, work: WorkData): Promise<WorkData>;
}

export type ResolveBookInput =
  | { isbn: string }
  | { olWorkKey: string; isbn?: string }
  | { gbVolumeId: string; isbn?: string };

export interface ResolveBookResult {
  workId: string;
  work: WorkData;
  edition: EditionInfo;
}

const emptyEdition = (isbn: string | null, work: WorkData): EditionInfo => ({
  isbn,
  coverUrl: work.coverUrl,
  language: null,
  publisher: null,
  publishYear: null,
});

function withCoverFallback(edition: EditionInfo, work: WorkData): EditionInfo {
  return { ...edition, coverUrl: edition.coverUrl ?? work.coverUrl };
}

function requireIsbn(raw: string): string {
  const isbn = normaliseIsbn(raw);
  if (!isbn) throw new HttpsError("invalid-argument", `"${raw}" isn't a valid ISBN-10 or ISBN-13.`);
  return isbn;
}

function unavailable(err: unknown): HttpsError {
  return new HttpsError(
    "unavailable",
    "The book catalogue couldn't be reached. Please try again in a moment.",
    { reason: String(err) },
  );
}

/** Build a work from an edition when Open Library has no work record for it. */
async function workFromEdition(ed: OlEdition, fetchImpl: FetchLike): Promise<WorkData | null> {
  if (!ed.title) return null;
  return {
    category: "book",
    source: "openlibrary",
    title: ed.title,
    authors: await fetchAuthorNames(ed.authorKeys, fetchImpl),
    description: null,
    coverUrl: ed.edition.coverUrl,
    firstPublishYear: null,
    isCustom: false,
    createdBy: null,
  };
}

async function resolveByIsbn(rawIsbn: string, store: BookStore, fetchImpl: FetchLike): Promise<ResolveBookResult> {
  const isbn = requireIsbn(rawIsbn);

  const indexed = await store.getIsbn(isbn);
  if (indexed) {
    const work = await store.getWork(indexed.workId);
    if (work) {
      return { workId: indexed.workId, work, edition: indexed.edition ?? emptyEdition(isbn, work) };
    }
  }

  let olError: unknown = null;
  try {
    const ed = await fetchOpenLibraryEdition(isbn, fetchImpl);
    if (ed && ed.workKey) {
      const workId = olWorkId(ed.workKey);
      let work = await store.getWork(workId);
      if (!work) {
        const fetched = (await fetchOpenLibraryWork(ed.workKey, fetchImpl)) ?? (await workFromEdition(ed, fetchImpl));
        if (fetched) {
          if (!fetched.coverUrl) fetched.coverUrl = ed.edition.coverUrl;
          fetched.title = preferEditionTitle(fetched.title, ed.title);
          work = await store.createWork(workId, fetched);
        }
      }
      if (work) {
        const edition = withCoverFallback(ed.edition, work);
        await store.setIsbn(isbn, { workId, edition });
        return { workId, work, edition };
      }
    }
  } catch (err) {
    if (!(err instanceof BookSourceError)) throw err;
    olError = err;
  }

  let gb: GbVolume | null;
  try {
    gb = await fetchGoogleBooksByIsbn(isbn, fetchImpl);
  } catch (err) {
    if (!(err instanceof BookSourceError)) throw err;
    throw unavailable(olError ?? err);
  }
  if (!gb) {
    if (olError) throw unavailable(olError);
    throw new HttpsError(
      "not-found",
      `No book found for ISBN ${isbn}. You can add it as a custom book instead.`,
    );
  }
  const workId = gbWorkId(gb.volumeId);
  const work = (await store.getWork(workId)) ?? (await store.createWork(workId, gb.work));
  const edition = withCoverFallback({ ...gb.edition, isbn }, work);
  await store.setIsbn(isbn, { workId, edition });
  return { workId, work, edition };
}

/** Edition details for an explicit ISBN given alongside a work key / volume id. */
async function editionForIsbn(
  isbn: string,
  workId: string,
  work: WorkData,
  store: BookStore,
  fetchImpl: FetchLike,
  fallback: EditionInfo | null,
): Promise<EditionInfo> {
  const indexed = await store.getIsbn(isbn);
  if (indexed?.edition && indexed.workId === workId) return indexed.edition;
  let edition: EditionInfo = fallback ? { ...fallback, isbn } : emptyEdition(isbn, work);
  if (!fallback) {
    try {
      const ed = await fetchOpenLibraryEdition(isbn, fetchImpl);
      if (ed) edition = ed.edition;
    } catch {
      /* best effort: edition details are optional */
    }
  }
  edition = withCoverFallback(edition, work);
  if (!indexed) await store.setIsbn(isbn, { workId, edition });
  return edition;
}

export async function resolveBook(
  input: ResolveBookInput,
  deps: { store: BookStore; fetch: FetchLike },
): Promise<ResolveBookResult> {
  const { store, fetch: fetchImpl } = deps;

  if ("olWorkKey" in input) {
    const key = normaliseOlWorkKey(input.olWorkKey);
    if (!key) throw new HttpsError("invalid-argument", `"${input.olWorkKey}" isn't an Open Library work key (e.g. OL45804W).`);
    const isbn = input.isbn ? requireIsbn(input.isbn) : null;
    const workId = olWorkId(key);
    let work = await store.getWork(workId);
    if (!work) {
      let fetched: WorkData | null;
      try {
        fetched = await fetchOpenLibraryWork(key, fetchImpl);
      } catch (err) {
        if (err instanceof BookSourceError) throw unavailable(err);
        throw err;
      }
      if (!fetched) throw new HttpsError("not-found", `Open Library has no work ${key}.`);
      work = await store.createWork(workId, fetched);
    }
    const edition = isbn
      ? await editionForIsbn(isbn, workId, work, store, fetchImpl, null)
      : emptyEdition(null, work);
    return { workId, work, edition };
  }

  if ("gbVolumeId" in input) {
    const id = input.gbVolumeId.trim();
    if (!isValidGbVolumeId(id)) throw new HttpsError("invalid-argument", `"${input.gbVolumeId}" isn't a Google Books volume id.`);
    const isbn = input.isbn ? requireIsbn(input.isbn) : null;
    const workId = gbWorkId(id);
    let work = await store.getWork(workId);
    let gbEdition: EditionInfo | null = null;
    if (!work) {
      let vol: GbVolume | null;
      try {
        vol = await fetchGoogleBooksVolume(id, fetchImpl);
      } catch (err) {
        if (err instanceof BookSourceError) throw unavailable(err);
        throw err;
      }
      if (!vol) throw new HttpsError("not-found", `Google Books has no volume ${id}.`);
      work = await store.createWork(workId, vol.work);
      gbEdition = vol.edition;
    }
    const edition = isbn
      ? await editionForIsbn(isbn, workId, work, store, fetchImpl, gbEdition)
      : gbEdition ?? emptyEdition(null, work);
    return { workId, work, edition };
  }

  return resolveByIsbn(input.isbn, store, fetchImpl);
}
