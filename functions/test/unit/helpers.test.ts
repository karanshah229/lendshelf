import { describe, expect, it } from "vitest";
import { cleanIsbn, isbn10to13, isValidIsbn10, isValidIsbn13, normaliseIsbn } from "../../src/lib/isbn.js";
import { isE164, normalisePhone, waDigits } from "../../src/lib/phone.js";
import { computeSharedWithContacts } from "../../src/lib/sharing.js";
import { defaultShelfId, linkId, reviewId, watchId } from "../../src/model.js";

describe("normalisePhone", () => {
  it.each([
    ["+919000000001", "+919000000001"],
    ["+91 90000 00001", "+919000000001"],
    ["+91-900-000-0001", "+919000000001"],
    ["(+91) 9000000001", "+919000000001"],
    ["00919000000001", "+919000000001"],
    ["9000000001", "+919000000001"],
    ["09000000001", "+919000000001"],
    ["919000000001", "+919000000001"],
    ["+14155552671", "+14155552671"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s -> %s", (input, out) => {
    expect(normalisePhone(input)).toBe(out);
  });

  it.each(["", "abc", "12345", "+0123456789", "+91900000000123456", "+91 abc 123", "1234567"])("rejects %j", (input) => {
    expect(normalisePhone(input)).toBeNull();
  });

  it("uses a different default calling code when asked", () => {
    expect(normalisePhone("4155552671", "1")).toBe("+14155552671");
  });

  it("isE164 / waDigits", () => {
    expect(isE164("+919000000001")).toBe(true);
    expect(isE164("919000000001")).toBe(false);
    expect(waDigits("+919000000001")).toBe("919000000001");
  });
});

describe("ISBN", () => {
  it("validates ISBN-10 and ISBN-13 check digits", () => {
    expect(isValidIsbn10("054792822X")).toBe(true);
    expect(isValidIsbn10("0547928220")).toBe(false);
    expect(isValidIsbn13("9780547928227")).toBe(true);
    expect(isValidIsbn13("9780547928228")).toBe(false);
  });

  it("converts ISBN-10 to ISBN-13", () => {
    expect(isbn10to13("054792822X")).toBe("9780547928227");
    expect(isbn10to13("0441013597")).toBe("9780441013593");
  });

  it("normalises any valid input to ISBN-13", () => {
    expect(normaliseIsbn("978-0-547-92822-7")).toBe("9780547928227");
    expect(normaliseIsbn("0-547-92822-x")).toBe("9780547928227");
    expect(normaliseIsbn(" 9780441013593 ")).toBe("9780441013593");
    expect(normaliseIsbn("12345")).toBeNull();
    expect(normaliseIsbn("9780547928228")).toBeNull();
    expect(cleanIsbn("0-547 92822-x")).toBe("054792822X");
  });
});

describe("sharedWithContacts", () => {
  it("is shelf.isPublic && visibility != hidden", () => {
    expect(computeSharedWithContacts(true, "lendable")).toBe(true);
    expect(computeSharedWithContacts(true, "visible")).toBe(true);
    expect(computeSharedWithContacts(true, "hidden")).toBe(false);
    expect(computeSharedWithContacts(false, "lendable")).toBe(false);
    expect(computeSharedWithContacts(false, "hidden")).toBe(false);
  });
});

describe("document ids", () => {
  it("follow SPEC formats", () => {
    expect(linkId("v", "o")).toBe("v_o");
    expect(reviewId("ol_OL45804W", "u1")).toBe("ol_OL45804W_u1");
    expect(watchId("u1", "wishlist", "ol_OL1W")).toBe("u1_wishlist_ol_OL1W");
    expect(defaultShelfId("u1")).toBe("default_u1");
  });
});
