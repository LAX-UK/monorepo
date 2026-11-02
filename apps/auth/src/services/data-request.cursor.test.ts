import { describe, expect, it } from "vitest";
import {
  InvalidDataRequestCursorError,
  NO_DUE_DATE_KEY,
  decodeCursor,
  encodeCursor,
  sortKey,
} from "./data-request.cursor.js";
import type { MergedRequestRow } from "./data-request.ports.js";

const row = {
  reference: "DR-0012",
  dueOn: "2026-12-02",
  requestedOn: "2026-11-02",
} as MergedRequestRow;

describe("data request cursor", () => {
  it("round-trips the sort key and the reference", () => {
    expect(decodeCursor("due", encodeCursor("due", row))).toEqual({
      key: "2026-12-02",
      reference: "DR-0012",
    });
    expect(decodeCursor("requested", encodeCursor("requested", row))).toEqual({
      key: "2026-11-02",
      reference: "DR-0012",
    });
  });

  it("sorts a request with no due date last", () => {
    expect(sortKey("due", { dueOn: null, requestedOn: "2026-11-02" })).toBe(NO_DUE_DATE_KEY);
  });

  it("refuses garbage, a different sort and a malformed position", () => {
    expect(() => decodeCursor("due", "not-a-cursor")).toThrow(InvalidDataRequestCursorError);
    expect(() => decodeCursor("requested", encodeCursor("due", row))).toThrow(
      InvalidDataRequestCursorError,
    );
    const bad = Buffer.from(JSON.stringify(["due", "'; drop table", "DR-1"])).toString("base64url");
    expect(() => decodeCursor("due", bad)).toThrow(InvalidDataRequestCursorError);
  });
});
