import { describe, expect, it } from "vitest";
import { decodeArtworkListCursor, encodeArtworkListCursor } from "./artwork-catalogue-cursor.js";
import { InvalidCatalogueCursorError } from "./catalogue-cursor.js";

describe("artwork list cursor", () => {
  it("round-trips title sort cursors", () => {
    const encoded = encodeArtworkListCursor({ sort: "titleAsc", title: "Alpha", id: "a1" });
    expect(decodeArtworkListCursor(encoded, "titleAsc")).toEqual({
      sort: "titleAsc",
      title: "Alpha",
      id: "a1",
    });
  });

  it("rejects cursor/sort mismatches", () => {
    const encoded = encodeArtworkListCursor({ sort: "titleAsc", title: "Alpha", id: "a1" });
    expect(() => decodeArtworkListCursor(encoded, "priceAsc")).toThrow(InvalidCatalogueCursorError);
  });

  it("accepts legacy newest cursors", () => {
    const createdAt = new Date("2026-09-15T12:00:00.000Z");
    const encoded = encodeArtworkListCursor({ sort: "newest", createdAt, id: "id-1" });
    expect(decodeArtworkListCursor(encoded, "newest")).toEqual({
      sort: "newest",
      createdAt,
      id: "id-1",
    });
  });
});
