import type { InvoiceLine } from "@auction/types";
import { gbpPenceToMajorString } from "./decimal-money.js";
import type { LotCheckoutPricing } from "./lot-checkout-pricing.js";

/** What a stored invoice says about a lot's price. */
export type StoredInvoicePricing = {
  totalPence: number;
  lines: readonly InvoiceLine[];
  pricingPolicyId: string | null;
};

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
  const kind = policyId.startsWith("tiered:") ? ("tiered" as const) : ("flat" as const);
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
