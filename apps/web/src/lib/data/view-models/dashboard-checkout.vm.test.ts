import { describe, expect, it } from "vitest";
import { buildCheckoutTotalsVm, buildInvoiceTotalsVm } from "./dashboard-checkout.vm";

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

describe("buildInvoiceTotalsVm", () => {
  const livePricing = {
    hammerMajor: "1000.00",
    premiumMajor: "200.00",
    totalMajor: "1200.00",
    policyId: "flat:0.2",
    kind: "flat" as const,
  };

  it("before an invoice exists, shows the lot's pricing", () => {
    expect(buildInvoiceTotalsVm(livePricing, null)).toEqual(buildCheckoutTotalsVm(livePricing));
  });

  it("shows the invoice's stored total, not today's pricing, and lines that add up to it", () => {
    // Raised at 25% (£1,250.00); the lot's rate has since changed to 20%.
    const out = buildInvoiceTotalsVm(livePricing, "1250.00");
    expect(out.total).toBe(1250);
    expect(out.hammer).toBe(1000);
    expect(out.premium).toBe(250);
    expect(Math.round(out.hammer * 100) + Math.round(out.premium * 100)).toBe(125_000);
    expect(out.premiumPercentLabel).toBe("25%");
  });
});
