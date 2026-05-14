/**
 * Band-based buyer-premium tier.
 *
 * `hammerThresholdMinor` — inclusive lower bound of the band in **minor units** (pence for GBP).
 * `rate`                 — decimal string with 4 d.p. ("0.1500" = 15%).
 *
 * Tiers are stored ascending by threshold. The rate applied to the **whole** hammer
 * is the one whose `hammerThresholdMinor` is the highest value ≤ hammer
 * (band-based — not progressive).
 *
 * Mirrors `BuyerPremiumTier` in `packages/db/src/schema/sales.ts`; lives in `@auction/types`
 * so non-DB consumers (validators, API, web, mobile, scripts) can share the shape without
 * pulling in `drizzle-orm`.
 */
export type BuyerPremiumTier = {
  hammerThresholdMinor: number;
  rate: string;
};

/**
 * Policy that computes the buyer's premium for a given hammer price.
 *
 * Implementations live in `@auction/validators` (`FlatRateBuyerPremiumPolicy`,
 * `TieredBuyerPremiumPolicy`) and must not depend on a database client — they are
 * pure value objects.
 */
export interface BuyerPremiumPolicy {
  /**
   * Premium due on `hammerMinor` (minor units), as a non-negative integer in minor units.
   * Implementations are responsible for rounding (the project uses banker's rounding to whole pence).
   */
  computePremiumMinor(hammerMinor: number): number;
  /**
   * Compute on a decimal **major-currency** input (e.g. "1234.56" GBP).
   * Returns a decimal **major-currency** string with 2 d.p. ("123.46").
   * Useful where call sites already pass decimal strings (legacy paths).
   */
  computePremiumMajor(hammerMajor: string): string;
  /**
   * Stable identifier for logs / event payloads / audit trails.
   * Format: `flat:0.1500` | `tiered:[{50000000,0.10},{0,0.15}]`.
   */
  readonly id: string;
}
