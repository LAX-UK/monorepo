import { z } from "zod";

export const BUYER_PREMIUM_RATE_MESSAGE =
  "Enter a rate from 0% to 100%, with up to two decimal places";

/**
 * A buyer's premium rate as the API takes it: a decimal string from "0" to "1" with up to four
 * places ("0.25"). Staff enter and read it as a percent ("25%") through the kit percent field.
 */
export const buyerPremiumRateSchema = z
  .string()
  .regex(/^\d(\.\d{1,4})?$/, BUYER_PREMIUM_RATE_MESSAGE)
  .refine((s) => {
    const n = Number.parseFloat(s);
    return n >= 0 && n <= 1;
  }, BUYER_PREMIUM_RATE_MESSAGE);

/** A rate, or "" when the field is left empty. */
export const optionalBuyerPremiumRateSchema = z.union([buyerPremiumRateSchema, z.literal("")]);
