import { describe, expect, it } from "vitest";
import { InvalidCatalogueCursorError } from "./catalogue-cursor.js";
import { decodeEnquiryInboxCursor, encodeEnquiryInboxCursor } from "./enquiry-inbox-cursor.js";

const cursor = {
  waiting: true,
  createdAt: "2026-03-01T10:00:00.123456Z",
  kind: "artwork" as const,
  id: "0b8f6c1e-5d7a-4a43-9b52-0d3a1f4c9e11",
};

describe("enquiry inbox cursor", () => {
  it("round-trips, keeping microsecond precision", () => {
    expect(decodeEnquiryInboxCursor(encodeEnquiryInboxCursor(cursor))).toEqual(cursor);
  });

  it("treats a missing cursor as the first page", () => {
    expect(decodeEnquiryInboxCursor(undefined)).toBeNull();
  });

  it.each([
    ["not base64 json", "%%%"],
    ["a millisecond-only timestamp", { ...cursor, createdAt: "2026-03-01T10:00:00.123Z" }],
    ["a missing waiting flag", { ...cursor, waiting: undefined }],
    ["an unknown kind", { ...cursor, kind: "order" }],
    ["a non-uuid id", { ...cursor, id: "1; drop table" }],
  ])("rejects %s", (_name, value) => {
    const token =
      typeof value === "string" ? value : Buffer.from(JSON.stringify(value)).toString("base64url");
    expect(() => decodeEnquiryInboxCursor(token)).toThrow(InvalidCatalogueCursorError);
  });
});
