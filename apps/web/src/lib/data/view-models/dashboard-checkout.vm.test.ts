import { describe, expect, it } from "vitest";
import { buildCheckoutTotalsVm } from "./dashboard-checkout.vm";

describe("buildCheckoutTotalsVm", () => {
  it("uses tiered checkoutPricing", () => {
    const out = buildCheckoutTotalsVm({
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

  it("computes flat percent label from premium / hammer", () => {
    const out = buildCheckoutTotalsVm({
      hammerMajor: "1000",
      premiumMajor: "250",
      totalMajor: "1250",
      policyId: "flat:lot",
      kind: "flat",
    });
    expect(out.premiumPercentLabel).toBe("25%");
  });
});
