import { describe, expect, it } from "vitest";
import { InvalidCatalogueCursorError } from "./catalogue-cursor.js";
import {
  decodeEditorialLinkCandidateCursor,
  encodeEditorialLinkCandidateCursor,
} from "./editorial-link-candidate-cursor.js";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("editorial link candidate cursor", () => {
  it("round-trips a title containing wildcards and unicode", () => {
    const cursor = { title: "100% _ Café", id: ID };
    expect(decodeEditorialLinkCandidateCursor(encodeEditorialLinkCandidateCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("treats a missing cursor as the first page", () => {
    expect(decodeEditorialLinkCandidateCursor(null)).toBeNull();
  });

  it.each([
    ["not base64 json", "garbage"],
    ["a non-uuid id", Buffer.from(JSON.stringify({ title: "a", id: "x" })).toString("base64url")],
    ["a missing title", Buffer.from(JSON.stringify({ id: ID })).toString("base64url")],
  ])("rejects %s", (_name, value) => {
    expect(() => decodeEditorialLinkCandidateCursor(value)).toThrow(InvalidCatalogueCursorError);
  });
});
