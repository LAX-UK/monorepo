import { describe, expect, it } from "vitest";
import { buildCheckoutTotalsVm } from "./dashboard-checkout.vm";

describe("buildCheckoutTotalsVm", () => {
  it("uses checkoutPricing when provided", () => {
    const out = buildCheckoutTotalsVm("999", "0.5", {
      hammerMajor: "1000",
      premiumMajor: "200",
      totalMajor: "1200",
      policyId: "tiered:sale-1",
      kind: "tiered",
    });
    expect(out.hammer).toBe(1000);
    expect(out.premium).toBe(200);
    expect(out.total).toBe(1200);
    expect(out.premiumPercentLabel).toBe("Tiered");
  });

  it("computes flat premium from rate when checkoutPricing is absent", () => {
    const out = buildCheckoutTotalsVm("1000", "0.25", undefined);
    expect(out.hammer).toBe(1000);
    expect(out.premium).toBe(250);
    expect(out.total).toBe(1250);
    expect(out.premiumPercentLabel).toBe("25%");
  });
});
