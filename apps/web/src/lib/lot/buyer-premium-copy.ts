import { type BuyersPremiumTerms, scheduleOfTerms } from "@auction/domain";
import type { BuyerPremiumSchedule, BuyerPremiumSource, Lot, Sale } from "@auction/types";
import {
  type BuyerPremiumSaleTerms,
  describeBuyerPremium,
  resolveBuyerPremium,
} from "@auction/validators";

/*
 * What buyers read about the buyer's premium, from the one resolver behind every charge: the
 * lot's own premium, else its sale's bands, else its sale's flat rate. Pages never print a rate
 * the invoice would not charge.
 */

/** Where the Conditions of Sale (clause 11 sets the standard premium) live. */
export const BUYER_PREMIUM_CONDITIONS_HREF = "/terms";

/** The one name every link to those Conditions uses, wherever the premium is mentioned. */
export const CONDITIONS_OF_SALE_LABEL = "Conditions of Sale";

export type BuyerPremiumCopy = {
  /** "15% up to £500,000, then 10% on the part above" or "20% on the hammer". */
  terms: string;
  /** "Buyer's premium: 15% up to £500,000, then 10% on the part above". */
  sentence: string;
  source: BuyerPremiumSource;
};

function copyOf(schedule: BuyerPremiumSchedule, source: BuyerPremiumSource): BuyerPremiumCopy {
  const terms = describeBuyerPremium(schedule);
  return { terms, sentence: `Buyer's premium: ${terms}`, source };
}

type LotPremiumSource = Pick<Lot, "buyerPremiumRate" | "saleId"> &
  Partial<Pick<Lot, "checkoutPricing">>;

/**
 * The premium a lot charges, in words. With its sale at hand the shared resolver decides; without
 * it, the server's resolved premium on the lot (`checkoutPricing.premium`) is used, then the lot's
 * own rate. A lot in a sale whose premium is not known says nothing rather than guess.
 */
export function lotBuyerPremiumCopy(
  lot: LotPremiumSource,
  sale?: BuyerPremiumSaleTerms | null,
): BuyerPremiumCopy | null {
  if (sale || !lot.saleId) {
    const { schedule, source } = resolveBuyerPremium({ lotRate: lot.buyerPremiumRate, sale });
    return copyOf(schedule, source);
  }
  const resolved = lot.checkoutPricing?.premium;
  if (resolved) return copyOf(resolved.schedule, resolved.source);
  if (lot.buyerPremiumRate) return copyOf({ kind: "flat", rate: lot.buyerPremiumRate }, "lot");
  return null;
}

/** The premium a sale charges its lots, in words. */
export function saleBuyerPremiumCopy(
  sale: Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers">,
): BuyerPremiumCopy {
  const { schedule, source } = resolveBuyerPremium({ lotRate: null, sale });
  return copyOf(schedule, source);
}

/** The terms the lot detail response sent (already resolved on the server), in words. */
export function termsBuyerPremiumCopy(terms: BuyersPremiumTerms): BuyerPremiumCopy {
  return copyOf(scheduleOfTerms(terms), terms.source ?? "sale_flat");
}
