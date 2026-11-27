import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookSourceError,
  FETCH_TIMEOUT_MS,
  getJson,
  fetchGoogleBooksByIsbn,
  fetchOpenLibraryEdition,
  fetchOpenLibraryWork,
  gbCoverUrl,
  languageCode,
  normaliseOlWorkKey,
  olCoverUrl,
  olDescription,
  parseYear,
  preferEditionTitle,
  resolveBook,
  USER_AGENT,
  type BookStore,
  type FetchLike,
} from "../../src/lib/books.js";
import type { IsbnIndexDoc, WorkData } from "../../src/model.js";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(process.cwd(), "test/fixtures", name), "utf8"));

type Route = { status: number; body?: unknown } | Error;

/** Fake fetch: exact URL -> response; anything else is a 404. Records calls. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const r = routes[url];
    if (r instanceof Error) throw r;
    const status = r?.status ?? 404;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (r && "body" in r ? r.body : { error: "notfound" }),
    };
  };
  return { fn: vi.fn(fn), calls };
}

function memoryStore() {
  const isbns = new Map<string, IsbnIndexDoc>();
  const works = new Map<string, WorkData>();
  const store: BookStore = {
    getIsbn: async (i) => isbns.get(i) ?? null,
    setIsbn: async (i, d) => void isbns.set(i, d),
    getWork: async (w) => works.get(w) ?? null,
    createWork: async (id, w) => {
      if (!works.has(id)) works.set(id, w);
      return works.get(id) as WorkData;
    },
  };
  return { store, isbns, works };
}

const OL = "https://openlibrary.org";
const GB = "https://www.googleapis.com/books/v1/volumes";
const HOBBIT_ROUTES: Record<string, Route> = {
  [`${OL}/isbn/9780547928227.json`]: { status: 200, body: fixture("ol-edition-9780547928227.json") },
  [`${OL}/works/OL27482W.json`]: { status: 200, body: fixture("ol-work-OL27482W.json") },
  [`${OL}/authors/OL26320A.json`]: { status: 200, body: fixture("ol-author-OL26320A.json") },
};
const NAGAS_ROUTES: Record<string, Route> = {
  [`${GB}?q=isbn:9789386228017`]: { status: 200, body: fixture("gb-isbn-9789386228017.json") },
  [`${GB}/x3qBDwAAQBAJ`]: { status: 200, body: fixture("gb-volume-x3qBDwAAQBAJ.json") },
};

describe("parsers", () => {
  it("olCoverUrl ignores missing/negative ids", () => {
    expect(olCoverUrl(14627509)).toBe("https://covers.openlibrary.org/b/id/14627509-L.jpg");
    expect(olCoverUrl(-1)).toBeNull();
    expect(olCoverUrl("12")).toBeNull();
  });

  it("normaliseOlWorkKey", () => {
    expect(normaliseOlWorkKey("OL27482W")).toBe("OL27482W");
    expect(normaliseOlWorkKey("/works/OL27482W")).toBe("OL27482W");
    expect(normaliseOlWorkKey("ol27482w")).toBe("OL27482W");
    expect(normaliseOlWorkKey("OL27482M")).toBeNull();
    expect(normaliseOlWorkKey("../etc")).toBeNull();
  });

  it("parseYear", () => {
    expect(parseYear("January 1938")).toBe(1938);
    expect(parseYear("May 04, 2021")).toBe(2021);
    expect(parseYear("2017-11-01")).toBe(2017);
    expect(parseYear("unknown")).toBeNull();
    expect(parseYear(undefined)).toBeNull();
  });

  it("olDescription handles both shapes", () => {
    expect(olDescription("Plain")).toBe("Plain");
    expect(olDescription({ type: "/type/text", value: "Typed" })).toBe("Typed");
    expect(olDescription(null)).toBeNull();
  });

  it("languageCode", () => {
    expect(languageCode("/languages/eng")).toBe("en");
    expect(languageCode("/languages/hin")).toBe("hi");
    expect(languageCode("en")).toBe("en");
    expect(languageCode("/languages/und")).toBeNull();
    expect(languageCode("/languages/xyz")).toBe("xyz");
  });

  it("gbCoverUrl forces https and drops the curl", () => {
    expect(gbCoverUrl({ imageLinks: { thumbnail: "http://books.google.com/x?id=1&zoom=1&edge=curl&source=gbs_api" } })).toBe(
      "https://books.google.com/x?id=1&zoom=1&source=gbs_api",
    );
    expect(gbCoverUrl({})).toBeNull();
  });
});

describe("preferEditionTitle", () => {
  it("uses a Latin edition title when the work title is in another script", () => {
    expect(preferEditionTitle("Преступление и наказание", "Crime and Punishment")).toBe("Crime and Punishment");
    expect(preferEditionTitle("Cien años de soledad", "One Hundred Years of Solitude")).toBe("Cien años de soledad");
    expect(preferEditionTitle("The Hobbit", "Le Hobbit")).toBe("The Hobbit");
    expect(preferEditionTitle("गोदान", null)).toBe("गोदान");
  });
});

describe("Open Library fetchers", () => {
  it("reads an edition", async () => {
    const { fn, calls } = fakeFetch(HOBBIT_ROUTES);
    const ed = await fetchOpenLibraryEdition("9780547928227", fn);
    expect(ed).toEqual({
      workKey: "OL27482W",
      title: "The Hobbit",
      authorKeys: [],
      edition: {
        isbn: "9780547928227",
        coverUrl: "https://covers.openlibrary.org/b/id/12003329-L.jpg",
        language: "en",
        publisher: "Mariner Books",
        publishYear: 2012,
      },
    });
    expect(calls[0]?.headers["User-Agent"]).toBe(USER_AGENT);
  });

  it("reads a work with author names", async () => {
    const { fn } = fakeFetch(HOBBIT_ROUTES);
    const w = await fetchOpenLibraryWork("OL27482W", fn);
    expect(w).toMatchObject({
      category: "book",
      source: "openlibrary",
      title: "The Hobbit",
      authors: ["J.R.R. Tolkien"],
      coverUrl: "https://covers.openlibrary.org/b/id/14627509-L.jpg",
      firstPublishYear: 1938,
      isCustom: false,
      createdBy: null,
    });
    expect(w?.description).toMatch(/^The Hobbit is a tale of high adventure/);
  });

  it("returns null for unknown ISBNs and throws on server errors", async () => {
    expect(await fetchOpenLibraryEdition("9780000000002", fakeFetch({}).fn)).toBeNull();
    const broken = fakeFetch({ [`${OL}/isbn/9780547928227.json`]: { status: 503 } });
    await expect(fetchOpenLibraryEdition("9780547928227", broken.fn)).rejects.toThrow(/HTTP 503/);
  });
});

describe("Google Books fetcher", () => {
  it("reads the first volume", async () => {
    const v = await fetchGoogleBooksByIsbn("9789386228017", fakeFetch(NAGAS_ROUTES).fn);
    expect(v).toEqual({
      volumeId: "x3qBDwAAQBAJ",
      isbns: ["9789386228017"],
      work: {
        category: "book",
        source: "googlebooks",
        title: "The Secret of the Nagas: Shiva Trilogy 2",
        authors: ["Amish Tripathi"],
        description: "Today, he is a god. 4000 years ago, he was just a man.",
        coverUrl: "https://books.google.com/books/content?id=x3qBDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        firstPublishYear: 2017,
        isCustom: false,
        createdBy: null,
      },
      edition: {
        isbn: "9789386228017",
        coverUrl: "https://books.google.com/books/content?id=x3qBDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        language: "en",
        publisher: "Westland",
        publishYear: 2017,
      },
    });
  });

  it("returns null when there are no items", async () => {
    const f = fakeFetch({ [`${GB}?q=isbn:9789386228017`]: { status: 200, body: fixture("gb-empty.json") } });
    expect(await fetchGoogleBooksByIsbn("9789386228017", f.fn)).toBeNull();
  });
});

describe("resolveBook", () => {
  let mem: ReturnType<typeof memoryStore>;
  beforeEach(() => {
    mem = memoryStore();
  });

  it("ISBN-13 via Open Library: creates the work and the isbnIndex", async () => {
    const { fn } = fakeFetch(HOBBIT_ROUTES);
    const r = await resolveBook({ isbn: "978-0-547-92822-7" }, { store: mem.store, fetch: fn });
    expect(r.workId).toBe("ol_OL27482W");
    expect(r.work.title).toBe("The Hobbit");
    expect(r.work.authors).toEqual(["J.R.R. Tolkien"]);
    expect(r.edition).toEqual({
      isbn: "9780547928227",
      coverUrl: "https://covers.openlibrary.org/b/id/12003329-L.jpg",
      language: "en",
      publisher: "Mariner Books",
      publishYear: 2012,
    });
    expect(mem.works.get("ol_OL27482W")?.title).toBe("The Hobbit");
    expect(mem.isbns.get("9780547928227")).toEqual({ workId: "ol_OL27482W", edition: r.edition });
  });

  it("accepts ISBN-10 and converts it", async () => {
    const { fn, calls } = fakeFetch(HOBBIT_ROUTES);
    const r = await resolveBook({ isbn: "054792822X" }, { store: mem.store, fetch: fn });
    expect(r.edition.isbn).toBe("9780547928227");
    expect(calls[0]?.url).toBe(`${OL}/isbn/9780547928227.json`);
  });

  it("second scan hits the isbnIndex without any network", async () => {
    await resolveBook({ isbn: "9780547928227" }, { store: mem.store, fetch: fakeFetch(HOBBIT_ROUTES).fn });
    const offline = fakeFetch({});
    const r = await resolveBook({ isbn: "9780547928227" }, { store: mem.store, fetch: offline.fn });
    expect(r.workId).toBe("ol_OL27482W");
    expect(offline.fn).not.toHaveBeenCalled();
  });

  it("reuses an existing work for a new edition (no work/author fetch)", async () => {
    await mem.store.createWork("ol_OL27482W", {
      category: "book", source: "openlibrary", title: "The Hobbit (stored)", authors: ["JRRT"], description: null,
      coverUrl: null, firstPublishYear: 1937, isCustom: false, createdBy: null,
    });
    const { fn, calls } = fakeFetch(HOBBIT_ROUTES);
    const r = await resolveBook({ isbn: "9780547928227" }, { store: mem.store, fetch: fn });
    expect(r.work.title).toBe("The Hobbit (stored)");
    expect(calls.map((c) => c.url)).toEqual([`${OL}/isbn/9780547928227.json`]);
  });

  it("falls back to Google Books when Open Library has no edition", async () => {
    const r = await resolveBook({ isbn: "9789386228017" }, { store: mem.store, fetch: fakeFetch(NAGAS_ROUTES).fn });
    expect(r.workId).toBe("gb_x3qBDwAAQBAJ");
    expect(r.work.source).toBe("googlebooks");
    expect(r.edition.isbn).toBe("9789386228017");
    expect(mem.isbns.get("9789386228017")?.workId).toBe("gb_x3qBDwAAQBAJ");
  });

  it("falls back to Google Books when Open Library is down", async () => {
    const f = fakeFetch({ ...NAGAS_ROUTES, [`${OL}/isbn/9789386228017.json`]: new Error("ECONNRESET") });
    const r = await resolveBook({ isbn: "9789386228017" }, { store: mem.store, fetch: f.fn });
    expect(r.workId).toBe("gb_x3qBDwAAQBAJ");
  });

  it("not-found when neither catalogue knows the ISBN", async () => {
    const f = fakeFetch({ [`${GB}?q=isbn:9780000000002`]: { status: 200, body: fixture("gb-empty.json") } });
    await expect(resolveBook({ isbn: "9780000000002" }, { store: mem.store, fetch: f.fn })).rejects.toMatchObject({
      code: "not-found",
      message: expect.stringContaining("custom book"),
    });
  });

  it("unavailable when both catalogues fail", async () => {
    const f = fakeFetch({
      [`${OL}/isbn/9780000000002.json`]: { status: 500 },
      [`${GB}?q=isbn:9780000000002`]: { status: 429 },
    });
    await expect(resolveBook({ isbn: "9780000000002" }, { store: mem.store, fetch: f.fn })).rejects.toMatchObject({
      code: "unavailable",
    });
  });

  it("rejects invalid ISBNs", async () => {
    await expect(resolveBook({ isbn: "9780547928228" }, { store: mem.store, fetch: fakeFetch({}).fn })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("olWorkKey (from a client search result) without ISBN", async () => {
    const r = await resolveBook({ olWorkKey: "/works/OL27482W" }, { store: mem.store, fetch: fakeFetch(HOBBIT_ROUTES).fn });
    expect(r.workId).toBe("ol_OL27482W");
    expect(r.edition).toEqual({
      isbn: null,
      coverUrl: "https://covers.openlibrary.org/b/id/14627509-L.jpg",
      language: null,
      publisher: null,
      publishYear: null,
    });
    expect(mem.isbns.size).toBe(0);
  });

  it("olWorkKey with ISBN fetches edition details and indexes the ISBN", async () => {
    const r = await resolveBook(
      { olWorkKey: "OL27482W", isbn: "9780547928227" },
      { store: mem.store, fetch: fakeFetch(HOBBIT_ROUTES).fn },
    );
    expect(r.edition.publisher).toBe("Mariner Books");
    expect(mem.isbns.get("9780547928227")?.workId).toBe("ol_OL27482W");
  });

  it("unknown olWorkKey is not-found; malformed is invalid-argument", async () => {
    await expect(resolveBook({ olWorkKey: "OL1W" }, { store: mem.store, fetch: fakeFetch({}).fn })).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(resolveBook({ olWorkKey: "nope" }, { store: mem.store, fetch: fakeFetch({}).fn })).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("gbVolumeId", async () => {
    const r = await resolveBook({ gbVolumeId: "x3qBDwAAQBAJ" }, { store: mem.store, fetch: fakeFetch(NAGAS_ROUTES).fn });
    expect(r.workId).toBe("gb_x3qBDwAAQBAJ");
    expect(r.work.title).toBe("The Secret of the Nagas");
    expect(r.edition.publisher).toBe("Westland");
  });

  it("unavailable errors carry no internal details", async () => {
    const f = fakeFetch({
      [`${OL}/isbn/9780000000002.json`]: { status: 500 },
      [`${GB}?q=isbn:9780000000002`]: { status: 503 },
    });
    const err = await resolveBook({ isbn: "9780000000002" }, { store: mem.store, fetch: f.fn }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "unavailable" });
    // Only a machine-readable reason, so the app can say "catalogue" instead of "offline".
    expect((err as { details?: unknown }).details).toEqual({ reason: "catalogue" });
    expect((err as Error).message).not.toContain("openlibrary");
  });
});

describe("resolveBook: ISBN given with a work key / volume id (must belong to it)", () => {
  let mem: ReturnType<typeof memoryStore>;
  const otherWork: WorkData = {
    category: "book", source: "openlibrary", title: "Something Else", authors: ["X"], description: null,
    coverUrl: "https://covers.openlibrary.org/b/id/1-L.jpg", firstPublishYear: 2000, isCustom: false, createdBy: null,
  };
  beforeEach(() => {
    mem = memoryStore();
  });

  it("OL: an ISBN whose edition belongs to another work isn't stamped or cached", async () => {
    await mem.store.createWork("ol_OL99W", otherWork);
    const r = await resolveBook({ olWorkKey: "OL99W", isbn: "9780547928227" }, { store: mem.store, fetch: fakeFetch(HOBBIT_ROUTES).fn });
    expect(r.workId).toBe("ol_OL99W");
    expect(r.edition).toEqual({ isbn: null, coverUrl: otherWork.coverUrl, language: null, publisher: null, publishYear: null });
    expect(mem.isbns.size).toBe(0);
  });

  it("OL: an ISBN Open Library doesn't know (or can't be reached for) isn't cached", async () => {
    await mem.store.createWork("ol_OL99W", otherWork);
    const r = await resolveBook({ olWorkKey: "OL99W", isbn: "9780000000002" }, { store: mem.store, fetch: fakeFetch({}).fn });
    expect(r.edition.isbn).toBeNull();
    const down = fakeFetch({ [`${OL}/isbn/9780000000002.json`]: new Error("ECONNRESET") });
    const r2 = await resolveBook({ olWorkKey: "OL99W", isbn: "9780000000002" }, { store: mem.store, fetch: down.fn });
    expect(r2.edition.isbn).toBeNull();
    expect(mem.isbns.size).toBe(0);
  });

  it("GB: cached only when the volume lists the ISBN", async () => {
    const ok = await resolveBook({ gbVolumeId: "x3qBDwAAQBAJ", isbn: "9789386228017" }, { store: mem.store, fetch: fakeFetch(NAGAS_ROUTES).fn });
    expect(ok.edition.isbn).toBe("9789386228017");
    expect(mem.isbns.get("9789386228017")?.workId).toBe("gb_x3qBDwAAQBAJ");

    // Work now stored: the volume is fetched again to verify a different ISBN.
    const f = fakeFetch(NAGAS_ROUTES);
    const bad = await resolveBook({ gbVolumeId: "x3qBDwAAQBAJ", isbn: "9780547928227" }, { store: mem.store, fetch: f.fn });
    expect(bad.edition.isbn).toBeNull();
    expect(mem.isbns.has("9780547928227")).toBe(false);
    expect(f.calls.map((c) => c.url)).toEqual([`${GB}/x3qBDwAAQBAJ`]);
  });

  it("an ISBN already indexed to another work is never overwritten", async () => {
    await resolveBook({ isbn: "9780547928227" }, { store: mem.store, fetch: fakeFetch(HOBBIT_ROUTES).fn });
    await mem.store.createWork("ol_OL99W", otherWork);
    await resolveBook({ olWorkKey: "OL99W", isbn: "9780547928227" }, { store: mem.store, fetch: fakeFetch(HOBBIT_ROUTES).fn });
    expect(mem.isbns.get("9780547928227")?.workId).toBe("ol_OL27482W");
  });
});

describe("fetch timeouts", () => {
  /** A fetch that never answers until its signal aborts. */
  const hanging: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });

  it("getJson passes an abort signal and turns a timeout into a BookSourceError", async () => {
    const started = Date.now();
    await expect(getJson(hanging, "https://openlibrary.org/isbn/1.json", 50)).rejects.toBeInstanceOf(BookSourceError);
    expect(Date.now() - started).toBeLessThan(5_000);
    const seen: (AbortSignal | undefined)[] = [];
    await getJson(async (_u, init) => {
      seen.push(init?.signal);
      return { ok: true, status: 200, json: async () => ({}) };
    }, "https://x");
    expect(seen[0]).toBeInstanceOf(AbortSignal);
    expect(FETCH_TIMEOUT_MS).toBe(8000);
  });

  it("an Open Library timeout falls back to Google Books", async () => {
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const f = fakeFetch({ ...NAGAS_ROUTES, [`${OL}/isbn/9789386228017.json`]: timeout });
    const r = await resolveBook({ isbn: "9789386228017" }, { store: memoryStore().store, fetch: f.fn });
    expect(r.workId).toBe("gb_x3qBDwAAQBAJ");
  });
});
