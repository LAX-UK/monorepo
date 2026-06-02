import { describe, expect, it } from "vitest";
import { saleAllowsStreamUrl, saleAllowsWebBidding, saleInheritsLotTiming } from "./sale-mode";

describe("sale-mode web facade", () => {
  it("online allows web bidding and not stream URLs", () => {
    expect(saleAllowsWebBidding("online")).toBe(true);
    expect(saleAllowsStreamUrl("online")).toBe(false);
    expect(saleInheritsLotTiming("online")).toBe(false);
  });

  it("onsite disallows web bidding and allows stream URLs", () => {
    expect(saleAllowsWebBidding("onsite")).toBe(false);
    expect(saleAllowsStreamUrl("onsite")).toBe(true);
    expect(saleInheritsLotTiming("onsite")).toBe(true);
  });
});
