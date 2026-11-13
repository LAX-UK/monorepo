import { type BuyersPremiumTerms, bandFromStored, isBuyerPremiumRate } from "@auction/domain";
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
  const premiumLines = invoice.lines.filter((line) => line.kind === "buyers_premium");
  const [premiumLine] = premiumLines;
  return {
    hammerMajor: gbpPenceToMajorString(penceOf(invoice.lines, "hammer")),
    premiumMajor: gbpPenceToMajorString(penceOf(invoice.lines, "buyers_premium")),
    totalMajor: gbpPenceToMajorString(invoice.totalPence),
    policyId,
    kind,
    // The receipt names the premium as the invoice does; several premium lines have no one name.
    ...(premiumLines.length === 1 && premiumLine ? { premiumLabel: premiumLine.label } : {}),
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

type StoredBand = { hammerThresholdMinor: number; rate: string };

const isStoredBand = (band: unknown): band is StoredBand =>
  typeof band === "object" &&
  band !== null &&
  Number.isSafeInteger((band as StoredBand).hammerThresholdMinor) &&
  isBuyerPremiumRate((band as StoredBand).rate);

/** `bands:[0:0.1500,50000000:0.1000]`, as the banded policy writes its id. */
function bandsOfPolicyId(list: string): StoredBand[] | null {
  const bands = list.split(",").map((entry) => {
    const [threshold, rate] = entry.split(":");
    return { hammerThresholdMinor: Number(threshold), rate: rate ?? "" };
  });
  return bands.length > 0 && bands.every(isStoredBand) ? bands : null;
}

/** `tiered:[{"hammerThresholdMinor":0,"rate":"0.15"},…]`, as the release before clause 11 wrote it. */
function tiersOfPolicyId(json: string): StoredBand[] | null {
  try {
    const tiers: unknown = JSON.parse(json);
    return Array.isArray(tiers) && tiers.length > 0 && tiers.every(isStoredBand) ? tiers : null;
  } catch {
    return null;
  }
}

/**
 * The premium a sold lot's invoice charged, in the lot page's terms, read from the invoice's
 * pricing policy rather than today's rules, so the words match the invoiced figure:
 * - `flat:<rate>`: that rate on the hammer;
 * - `bands:[…]`: those bands, slice by slice;
 * - `tiered:[…]` (raised before clause 11): one rate on the whole hammer, the band the hammer
 *   reached, which is what that invoice charged.
 * `null` when the invoice names no policy the page can read (the page then uses today's rules).
 */
export function invoicedBuyersPremiumTerms(sold: InvoicedSalePrice): BuyersPremiumTerms | null {
  const id = sold.pricingPolicyId ?? "";
  const flat = /^flat:(.+)$/u.exec(id)?.[1];
  if (flat !== undefined) return isBuyerPremiumRate(flat) ? { kind: "flat", rate: flat } : null;
  const banded = /^bands:\[(.+)\]$/u.exec(id)?.[1];
  if (banded !== undefined) {
    const bands = bandsOfPolicyId(banded);
    if (!bands) return null;
    return {
      kind: "banded",
      bands: [...bands]
        .sort((a, b) => a.hammerThresholdMinor - b.hammerThresholdMinor)
        .map(bandFromStored),
    };
  }
  const tiered = /^tiered:(.+)$/u.exec(id)?.[1];
  if (tiered !== undefined) {
    const tiers = tiersOfPolicyId(tiered);
    if (!tiers) return null;
    const reached = [...tiers]
      .sort((a, b) => a.hammerThresholdMinor - b.hammerThresholdMinor)
      .filter((tier) => sold.hammerPence >= tier.hammerThresholdMinor)
      .at(-1);
    return reached ? { kind: "flat", rate: reached.rate } : null;
  }
  return null;
}
