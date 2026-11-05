import { describe, expect, it } from "vitest";
import {
  InvalidCatalogueCursorError,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
} from "./catalogue-cursor.js";

describe("catalogue cursor", () => {
  it("round-trips a stable created-at and id tuple", () => {
    const createdAt = new Date("2026-09-15T12:00:00.000Z");
    const encoded = encodeCatalogueCursor({ createdAt, id: "stable-id" });

    expect(decodeCatalogueCursor(encoded)).toEqual({
      createdAt,
      id: "stable-id",
    });
    expect(encoded).not.toContain(createdAt.toISOString());
  });

  it("round-trips a microsecond position", () => {
    const encoded = encodeCatalogueCursor({
      createdAt: new Date("2026-09-15T12:00:00.123Z"),
      createdAtMicros: "2026-09-15T12:00:00.123456Z",
      id: "stable-id",
    });
    const decoded = decodeCatalogueCursor(encoded);

    expect(decoded?.createdAtMicros).toBe("2026-09-15T12:00:00.123456Z");
    expect(decoded?.createdAt.toISOString()).toBe("2026-09-15T12:00:00.123Z");
    expect(decoded?.id).toBe("stable-id");
  });

  it("still decodes a cursor issued with millisecond precision", () => {
    const legacy = Buffer.from(
      JSON.stringify({ createdAt: "2026-09-15T12:00:00.123Z", id: "stable-id" }),
    ).toString("base64url");

    expect(decodeCatalogueCursor(legacy)).toEqual({
      createdAt: new Date("2026-09-15T12:00:00.123Z"),
      id: "stable-id",
    });
  });

  it("rejects a cursor whose timestamp is not a date", () => {
    const bad = Buffer.from(JSON.stringify({ createdAt: "nope", id: "x" })).toString("base64url");
    expect(() => decodeCatalogueCursor(bad)).toThrow(InvalidCatalogueCursorError);
  });

  it("rejects malformed cursors as client input errors", () => {
    expect(() => decodeCatalogueCursor("not-a-cursor")).toThrow(InvalidCatalogueCursorError);
  });
});
