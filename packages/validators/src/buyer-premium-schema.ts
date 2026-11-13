import { rateToTenThousandths } from "@auction/domain";
import { z } from "zod";

const RATE_PATTERN = /^\d(\.\d{1,4})?$/u;

const tierSchema = z.object({
  hammerThresholdMinor: z.number().int().nonnegative().finite(),
  rate: z
    .string()
    .regex(RATE_PATTERN, "Rate must be a decimal between 0 and 1 with up to 4 d.p.")
    .refine((s) => rateToTenThousandths(s) !== null, "Rate must be between 0 and 1"),
});

/**
 * Zod schema for `BuyerPremiumTier` rows on `sale.buyer_premium_tiers`.
 *
 * Validation:
 * - non-empty array
 * - thresholds non-negative integers (minor units)
 * - rates are decimal strings between 0 and 1 with up to 4 d.p.
 * - first band MUST start at threshold 0 (covers all hammer values)
 * - thresholds strictly ascending and unique
 */
export const buyerPremiumTiersSchema = z
  .array(tierSchema)
  .min(1, "Buyer premium tiers must have at least one entry")
  .max(16, "Buyer premium tiers capped at 16 entries")
  .superRefine((tiers, ctx) => {
    if (tiers[0]?.hammerThresholdMinor !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "First tier must start at hammerThresholdMinor 0",
        path: [0, "hammerThresholdMinor"],
      });
    }
    for (let i = 1; i < tiers.length; i++) {
      const prev = tiers[i - 1];
      const cur = tiers[i];
      if (!prev || !cur) continue;
      if (cur.hammerThresholdMinor <= prev.hammerThresholdMinor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tiers must be strictly ascending by hammerThresholdMinor",
          path: [i, "hammerThresholdMinor"],
        });
      }
    }
  });

export type BuyerPremiumTiers = z.infer<typeof buyerPremiumTiersSchema>;
