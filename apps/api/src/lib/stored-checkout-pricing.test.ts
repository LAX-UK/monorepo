import { describe, expect, it } from "vitest";
import type { LotCheckoutPricing } from "./lot-checkout-pricing.js";
import {
  checkoutPricingFromInvoice,
  checkoutPricingFromInvoicedSale,
  invoicedBuyersPremiumTerms,
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
      premiumLabel: "Buyer's premium (25%)",
    });
  });

  it("carries the invoice's own premium line label, so the receipt names the slices charged", () => {
    const priced = checkoutPricingFromInvoice(live, {
      totalPence: 68_500_000,
      pricingPolicyId: "bands:[0:0.1500,50000000:0.1000]",
      lines: [
        { kind: "hammer", label: "Hammer price", ratePercent: null, amountPence: 60_000_000 },
        {
          kind: "buyers_premium",
          label: "Buyer's premium (15% of £500,000 + 10% of £100,000)",
          ratePercent: null,
          amountPence: 8_500_000,
        },
      ],
    });
    expect(priced.premiumLabel).toBe("Buyer's premium (15% of £500,000 + 10% of £100,000)");
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

describe("invoicedBuyersPremiumTerms", () => {
  const sold = (pricingPolicyId: string | null, hammerPence = 60_000_000) => ({
    hammerPence,
    premiumPence: 0,
    pricingPolicyId,
  });

  it("reads a flat invoice as that rate", () => {
    expect(invoicedBuyersPremiumTerms(sold("flat:0.2000"))).toEqual({
      kind: "flat",
      rate: "0.2000",
    });
  });

  it("reads a banded invoice as its bands, in order", () => {
    expect(invoicedBuyersPremiumTerms(sold("bands:[50000000:0.1000,0:0.1500]"))).toEqual({
      kind: "banded",
      bands: [
        { fromHammer: "0.00", rate: "0.1500" },
        { fromHammer: "500000.00", rate: "0.1000" },
      ],
    });
  });

  it("reads an invoice raised before clause 11 (tiered) as the one rate its hammer reached", () => {
    const tiers =
      'tiered:[{"hammerThresholdMinor":0,"rate":"0.15"},{"hammerThresholdMinor":50000000,"rate":"0.10"}]';
    expect(invoicedBuyersPremiumTerms(sold(tiers))).toEqual({ kind: "flat", rate: "0.10" });
    expect(invoicedBuyersPremiumTerms(sold(tiers, 49_999_999))).toEqual({
      kind: "flat",
      rate: "0.15",
    });
  });

  it("is null for a policy it cannot read, so the page uses today's rules", () => {
    for (const id of [null, "", "flat:abc", "bands:[x:y]", "tiered:not json", "other:1"]) {
      expect(invoicedBuyersPremiumTerms(sold(id))).toBeNull();
    }
  });
});
