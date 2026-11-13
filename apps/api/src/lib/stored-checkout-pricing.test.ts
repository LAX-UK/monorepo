import { describe, expect, it } from "vitest";
import type { LotCheckoutPricing } from "./lot-checkout-pricing.js";
import {
  checkoutPricingFromInvoice,
  checkoutPricingFromInvoicedSale,
} from "./stored-checkout-pricing.js";

const live: LotCheckoutPricing = {
  hammerMajor: "9999.00",
  premiumMajor: "2499.75",
  totalMajor: "12498.75",
  policyId: "flat:0.25",
  kind: "flat",
};

describe("checkoutPricingFromInvoice", () => {
  it("reports an invoice charged slice by slice (bands:) as tiered", () => {
    const priced = checkoutPricingFromInvoice(live, {
      totalPence: 68_500_000,
      pricingPolicyId: "bands:[0:0.1500,50000000:0.1000]",
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 60_000_000 },
        { kind: "buyers_premium", label: "Premium", ratePercent: null, amountPence: 8_500_000 },
      ],
    });
    expect(priced.kind).toBe("tiered");
  });

  it("takes hammer, premium and total from the invoice, not from the lot's price now", () => {
    expect(
      checkoutPricingFromInvoice(live, {
        totalPence: 125_000,
        pricingPolicyId: "flat:0.25",
        lines: [
          { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 100_000 },
          {
            kind: "buyers_premium",
            label: "Buyer's premium (25%)",
            ratePercent: "25",
            amountPence: 25_000,
          },
        ],
      }),
    ).toEqual({
      hammerMajor: "1000.00",
      premiumMajor: "250.00",
      totalMajor: "1250.00",
      policyId: "flat:0.25",
      kind: "flat",
    });
  });

  it("reports a tiered invoice as tiered", () => {
    const priced = checkoutPricingFromInvoice(live, {
      totalPence: 57_499_999,
      pricingPolicyId: "tiered:abc",
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 49_999_999 },
        {
          kind: "buyers_premium",
          label: "Buyer's premium (tiered)",
          ratePercent: null,
          amountPence: 7_500_000,
        },
      ],
    });
    expect(priced.kind).toBe("tiered");
    expect(priced.totalMajor).toBe("574999.99");
  });

  it("keeps the live split but the invoice's total when the invoice is a single legacy total", () => {
    expect(
      checkoutPricingFromInvoice(live, {
        totalPence: 1_000_00,
        pricingPolicyId: null,
        lines: [{ kind: "legacy_total", label: "Total", ratePercent: null, amountPence: 1_000_00 }],
      }),
    ).toEqual({ ...live, totalMajor: "1000.00" });
  });
});

describe("checkoutPricingFromInvoicedSale", () => {
  it("is the invoice's hammer plus premium, leaving out the buyer's own lines", () => {
    expect(
      checkoutPricingFromInvoicedSale(live, {
        hammerPence: 100_000,
        premiumPence: 25_000,
        pricingPolicyId: "flat:0.2500",
      }),
    ).toEqual({
      hammerMajor: "1000.00",
      premiumMajor: "250.00",
      totalMajor: "1250.00",
      policyId: "flat:0.2500",
      kind: "flat",
    });
  });

  it("reports banded invoices as tiered, under either policy id", () => {
    for (const pricingPolicyId of ["bands:[0:0.1500,50000000:0.1000]", "tiered:abc"]) {
      const priced = checkoutPricingFromInvoicedSale(live, {
        hammerPence: 60_000_000,
        premiumPence: 8_500_000,
        pricingPolicyId,
      });
      expect(priced.kind).toBe("tiered");
    }
  });

  it("keeps the live policy id when the invoice has none", () => {
    const priced = checkoutPricingFromInvoicedSale(live, {
      hammerPence: 100,
      premiumPence: 25,
      pricingPolicyId: null,
    });
    expect(priced.policyId).toBe("flat:0.25");
  });
});
