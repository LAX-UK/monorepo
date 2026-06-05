import { describe, expect, it } from "vitest";
import { amlBlockedBidErrorMatcher } from "./aml-blocked.matcher";

describe("amlBlockedBidErrorMatcher", () => {
  it("matches aml_blocked code", () => {
    const hit = amlBlockedBidErrorMatcher.match("aml_blocked");
    expect(hit?.title).toBe("Bidding suspended");
    expect(hit?.severity).toBe("error");
  });

  it("ignores unrelated codes", () => {
    expect(amlBlockedBidErrorMatcher.match("kyc_required")).toBeNull();
  });
});
