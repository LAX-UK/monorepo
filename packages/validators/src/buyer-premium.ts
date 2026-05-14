import type { BuyerPremiumPolicy, BuyerPremiumTier } from "@auction/types";
import { z } from "zod";

/**
 * Zod schema for `BuyerPremiumTier` rows on `sale.buyer_premium_tiers`.
 *
 * Validation:
 * - non-empty array
 * - thresholds non-negative integers (minor units)
 * - rates are decimal strings between 0 and 1 with up to 4 d.p.
 * - first tier MUST start at threshold 0 (covers all hammer values)
 * - thresholds strictly ascending and unique
 */
const tierSchema = z.object({
  hammerThresholdMinor: z.number().int().nonnegative().finite(),
  rate: z
    .string()
    .regex(/^\d(\.\d{1,4})?$/u, "Rate must be a decimal between 0 and 1 with up to 4 d.p.")
    .refine((s) => {
      const n = Number.parseFloat(s);
      return n >= 0 && n <= 1;
    }, "Rate must be between 0 and 1"),
});

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

/**
 * Banker's rounding (round-half-to-even) of a decimal fraction × integer minor units.
 * Returns a non-negative integer (in minor units). Used by the strategies.
 */
export function roundPremiumMinor(hammerMinor: number, rate: string): number {
  if (!Number.isFinite(hammerMinor) || hammerMinor < 0) return 0;
  const rateNum = Number.parseFloat(rate);
  if (!Number.isFinite(rateNum) || rateNum <= 0) return 0;
  const raw = hammerMinor * rateNum;
  return bankersRound(raw);
}

function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Convert a decimal-major string ("123.45") to integer minor units (12345).
 * Negative / non-numeric inputs round to 0 (defensive — invariant guarded at write time).
 */
export function majorToMinor(major: string): number {
  const trimmed = (major ?? "").trim();
  if (!trimmed) return 0;
  if (!/^-?\d+(\.\d+)?$/u.test(trimmed)) return 0;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function minorToMajor(minor: number): string {
  if (!Number.isFinite(minor) || minor < 0) return "0.00";
  const major = Math.round(minor) / 100;
  return major.toFixed(2);
}

/**
 * Flat-rate buyer premium — current behaviour for lots without sale-level tier override.
 *
 * Single Responsibility: one rate × hammer → premium.
 */
export class FlatRateBuyerPremiumPolicy implements BuyerPremiumPolicy {
  readonly id: string;
  constructor(private readonly rate: string) {
    this.id = `flat:${rate}`;
  }
  computePremiumMinor(hammerMinor: number): number {
    return roundPremiumMinor(hammerMinor, this.rate);
  }
  computePremiumMajor(hammerMajor: string): string {
    return minorToMajor(this.computePremiumMinor(majorToMinor(hammerMajor)));
  }
}

/**
 * Band-based tiered premium. The rate that applies to the WHOLE hammer is the
 * one whose `hammerThresholdMinor` is the highest ≤ hammer (not progressive).
 *
 * Sales config example (sales.csv): `[15% under £500k, 10% above]` →
 *  - hammer £499,999.99 → 15% on the whole hammer
 *  - hammer £500,000.00 → 10% on the whole hammer
 *
 * Open/Closed: a new pricing rule (e.g. progressive / slabs) is a new class, no edits here.
 */
export class TieredBuyerPremiumPolicy implements BuyerPremiumPolicy {
  readonly id: string;
  private readonly sortedTiers: BuyerPremiumTier[];

  constructor(tiers: readonly BuyerPremiumTier[]) {
    if (tiers.length === 0) {
      throw new Error("TieredBuyerPremiumPolicy: tiers must be non-empty");
    }
    this.sortedTiers = [...tiers].sort((a, b) => a.hammerThresholdMinor - b.hammerThresholdMinor);
    if (this.sortedTiers[0]?.hammerThresholdMinor !== 0) {
      throw new Error("TieredBuyerPremiumPolicy: first tier must start at hammerThresholdMinor 0");
    }
    this.id = `tiered:${JSON.stringify(this.sortedTiers)}`;
  }

  computePremiumMinor(hammerMinor: number): number {
    const tier = this.selectTier(hammerMinor);
    return roundPremiumMinor(hammerMinor, tier.rate);
  }

  computePremiumMajor(hammerMajor: string): string {
    return minorToMajor(this.computePremiumMinor(majorToMinor(hammerMajor)));
  }

  /** Highest-threshold tier whose lower bound is ≤ hammer. */
  private selectTier(hammerMinor: number): BuyerPremiumTier {
    const safe = Number.isFinite(hammerMinor) && hammerMinor >= 0 ? hammerMinor : 0;
    let chosen = this.sortedTiers[0];
    if (!chosen) {
      throw new Error("TieredBuyerPremiumPolicy: empty tiers (invariant)");
    }
    for (const t of this.sortedTiers) {
      if (safe >= t.hammerThresholdMinor) {
        chosen = t;
      } else {
        break;
      }
    }
    return chosen;
  }
}

/**
 * Pricing context: where the strategy reads its inputs from.
 * - `saleTiers`: optional sale-level tier override (from `sale.buyer_premium_tiers`).
 * - `lotRate`: per-lot flat rate (from `lot.buyer_premium_rate`, the existing source of truth).
 *
 * Decision: when `saleTiers` is non-null and non-empty it overrides the lot rate.
 * This preserves the existing per-lot rate as the default while letting a sale opt into
 * band-based pricing without editing every lot row.
 */
export type BuyerPremiumContext = {
  saleTiers?: readonly BuyerPremiumTier[] | null;
  lotRate: string;
};

/**
 * Dependency-inverted factory: callers depend on `BuyerPremiumPolicy`, not on concrete classes.
 *
 * `buildBuyerPremiumPolicy({ saleTiers, lotRate })`
 *  - returns `TieredBuyerPremiumPolicy` when `saleTiers` is present and non-empty
 *  - returns `FlatRateBuyerPremiumPolicy(lotRate)` otherwise (existing behaviour)
 */
export function buildBuyerPremiumPolicy(ctx: BuyerPremiumContext): BuyerPremiumPolicy {
  if (ctx.saleTiers && ctx.saleTiers.length > 0) {
    return new TieredBuyerPremiumPolicy(ctx.saleTiers);
  }
  return new FlatRateBuyerPremiumPolicy(ctx.lotRate);
}
