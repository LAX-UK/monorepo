import { describe, expect, it } from "vitest";
import { shouldSkipOwnBidEcho } from "./own-bid-echo-guard";

describe("shouldSkipOwnBidEcho", () => {
  const own = {
    bidId: "bid-own",
    amount: "500",
    leadingBidderId: "user-1",
    at: Date.now(),
  };

  it("skips when bid id matches own bid", () => {
    expect(shouldSkipOwnBidEcho({ bidId: "bid-own", amount: "500" }, own, "user-1")).toBe(true);
  });

  it("skips stale lower amount while user was leading", () => {
    expect(shouldSkipOwnBidEcho({ bidId: "bid-other", amount: "400" }, own, "user-1")).toBe(true);
  });

  it("skips when emittedAt predates own bid at same or lower amount", () => {
    expect(
      shouldSkipOwnBidEcho(
        { bidId: "bid-other", amount: "500", emittedAt: own.at - 1000 },
        own,
        "user-1",
      ),
    ).toBe(true);
  });

  it("does not skip higher competing bid even when emittedAt predates own bid", () => {
    expect(
      shouldSkipOwnBidEcho(
        { bidId: "bid-other", amount: "600", emittedAt: own.at - 1000 },
        own,
        "user-1",
      ),
    ).toBe(false);
  });

  it("does not skip unrelated bid updates", () => {
    expect(shouldSkipOwnBidEcho({ bidId: "bid-other", amount: "600" }, own, "user-2")).toBe(false);
  });
});
