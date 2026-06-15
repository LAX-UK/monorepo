import { describe, expect, it } from "vitest";
import { mapBidError } from "./index.js";

describe("alreadyLeadingBidErrorMatcher", () => {
  it("maps already_leading code", () => {
    const hit = mapBidError("already_leading", { code: "already_leading" });
    expect(hit.title).toBe("You are leading");
    expect(hit.severity).toBe("warning");
    expect(hit.actionKey).toBe("switch-to-auto-bid");
  });

  it("maps bid_in_flight code", () => {
    const hit = mapBidError("bid_in_flight", { code: "bid_in_flight" });
    expect(hit.title).toBe("Bid in progress");
  });
});
