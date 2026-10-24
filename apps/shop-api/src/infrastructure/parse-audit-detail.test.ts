import { describe, expect, it } from "vitest";
import { parseAuditDetail } from "./drizzle-admin-detail.repository.js";

describe("parseAuditDetail", () => {
  it("returns the recorded after-state when it is a JSON object", () => {
    expect(parseAuditDetail('{"amountPence":1500,"reason":"goodwill"}')).toEqual({
      amountPence: 1500,
      reason: "goodwill",
    });
  });

  it("drops anything that is not an object, rather than failing the order page", () => {
    expect(parseAuditDetail(null)).toBeNull();
    expect(parseAuditDetail("[1,2]")).toBeNull();
    expect(parseAuditDetail('"text"')).toBeNull();
    expect(parseAuditDetail("{not json")).toBeNull();
  });
});
