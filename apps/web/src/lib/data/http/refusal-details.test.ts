import { parseRefusalDetails } from "@/lib/data/http/refusal-details";
import { describe, expect, it } from "vitest";

describe("parseRefusalDetails", () => {
  it("keeps the string facts of a refusal", () => {
    expect(parseRefusalDetails({ nextBidAmount: "7500.00", count: 3 })).toEqual({
      nextBidAmount: "7500.00",
    });
  });

  it("treats a missing, empty or malformed body as no details", () => {
    expect(parseRefusalDetails(undefined)).toBeUndefined();
    expect(parseRefusalDetails(null)).toBeUndefined();
    expect(parseRefusalDetails(["a"])).toBeUndefined();
    expect(parseRefusalDetails({})).toBeUndefined();
    expect(parseRefusalDetails("text")).toBeUndefined();
  });
});
