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

    expect(decodeCatalogueCursor(encoded)).toEqual({ createdAt, id: "stable-id" });
    expect(encoded).not.toContain(createdAt.toISOString());
  });

  it("rejects malformed cursors as client input errors", () => {
    expect(() => decodeCatalogueCursor("not-a-cursor")).toThrow(InvalidCatalogueCursorError);
  });
});
