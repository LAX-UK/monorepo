import { describe, expect, it } from "vitest";
import { mapBidError } from "./index";

describe("mapBidError", () => {
  it("maps seller own lot message to info", () => {
    const r = mapBidError("Seller cannot bid on own lot");
    expect(r.severity).toBe("info");
    expect(r.message).toContain("seller");
  });

  it("maps staff / role gate codes", () => {
    for (const code of ["admin_cannot_buy", "bidding_not_allowed_for_role"] as const) {
      const r = mapBidError(code);
      expect(r.title).toBeDefined();
      expect(r.severity).toBe("info");
    }
  });

  it("passes through unknown errors as error severity", () => {
    const r = mapBidError("Something weird");
    expect(r.message).toBe("Something weird");
    expect(r.severity).toBe("error");
  });

  it("passes min bid prefix through", () => {
    const raw = "Bid must be at least $500.00";
    const r = mapBidError(raw);
    expect(r.message).toBe(raw);
    expect(r.severity).toBe("error");
  });
});
