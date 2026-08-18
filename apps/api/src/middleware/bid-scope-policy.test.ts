import { describe, expect, it } from "vitest";
import { hasBidScope, requiredBidScope } from "./bid-scope-policy.js";

describe("Bid resource scope policy", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("requires bid.read for %s", (method) => {
    expect(requiredBidScope(method)).toBe("bid.read");
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("requires bid.write for %s", (method) => {
    expect(requiredBidScope(method)).toBe("bid.write");
  });

  it("does not treat write scope as an implicit read scope", () => {
    expect(hasBidScope(["bid.write"], "bid.read")).toBe(false);
    expect(hasBidScope(["bid.read"], "bid.read")).toBe(true);
  });
});
