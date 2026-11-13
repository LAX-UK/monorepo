import { STANDARD_BUYER_PREMIUM, describeBuyerPremium } from "@auction/validators";

/** The buyer's premium line seeded sales print in their terms: the published standard. */
export const SEED_BUYER_PREMIUM_TERMS = `Buyer's premium: ${describeBuyerPremium(STANDARD_BUYER_PREMIUM)}.`;

/** Placeholder until ops supplies final PDF / hosted copy. */
export const DEFAULT_CONDITIONS_OF_SALE =
  "LAX buyer's premium and conditions of sale apply. Replace this text with the final legal copy from operations.";
