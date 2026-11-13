import type { InvoicedSalePrice } from "@auction/persistence/interfaces";
import type { InvoiceLine } from "@auction/types";
import { isBandedPremiumPolicyId } from "@auction/validators";
import { gbpPenceToMajorString } from "./decimal-money.js";
import type { LotCheckoutPricing } from "./lot-checkout-pricing.js";

/** What a stored invoice says about a lot's price. */
export type StoredInvoicePricing = {
  totalPence: number;
  lines: readonly InvoiceLine[];
  pricingPolicyId: string | null;
};

const kindOf = (policyId: string) =>
  isBandedPremiumPolicyId(policyId) ? ("tiered" as const) : ("flat" as const);

const penceOf = (lines: readonly InvoiceLine[], kind: InvoiceLine["kind"]) =>
  lines.filter((line) => line.kind === kind).reduce((sum, line) => sum + line.amountPence, 0);

/**
 * The checkout figures of a lot that already has an invoice: the invoice's own hammer, premium
 * and total, which no later change to the lot or its sale can alter. An invoice with no hammer
 * line (a single legacy total) keeps the live hammer and premium split but takes the invoice's
 * total, so the figure shown is always the one that is owed.
 */
export function checkoutPricingFromInvoice(
  live: LotCheckoutPricing,
  invoice: StoredInvoicePricing,
): LotCheckoutPricing {
  const policyId = invoice.pricingPolicyId ?? live.policyId;
  const kind = kindOf(policyId);
  const hasHammer = invoice.lines.some((line) => line.kind === "hammer");
  if (!hasHammer) {
    return { ...live, totalMajor: gbpPenceToMajorString(invoice.totalPence), policyId, kind };
  }
  return {
    hammerMajor: gbpPenceToMajorString(penceOf(invoice.lines, "hammer")),
    premiumMajor: gbpPenceToMajorString(penceOf(invoice.lines, "buyers_premium")),
    totalMajor: gbpPenceToMajorString(invoice.totalPence),
    policyId,
    kind,
  };
}

/**
 * The price anyone may see of a sold lot whose invoice is raised: the invoice's hammer and
 * buyer's premium, which no later change to the lot or its sale can alter. The buyer's own lines
 * (VAT, delivery) are not part of it, so the total is hammer plus premium, as on a live lot.
 */
export function checkoutPricingFromInvoicedSale(
  live: LotCheckoutPricing,
  sold: InvoicedSalePrice,
): LotCheckoutPricing {
  const policyId = sold.pricingPolicyId ?? live.policyId;
  return {
    hammerMajor: gbpPenceToMajorString(sold.hammerPence),
    premiumMajor: gbpPenceToMajorString(sold.premiumPence),
    totalMajor: gbpPenceToMajorString(sold.hammerPence + sold.premiumPence),
    policyId,
    kind: kindOf(policyId),
  };
}
