/**
 * One buyer's premium band.
 *
 * `hammerThresholdMinor` — where the band starts, in **minor units** (pence for GBP).
 * `rate`                 — decimal string with up to 4 d.p. ("0.1500" = 15%).
 *
 * Bands are stored ascending by threshold, the first at 0. They are charged slice by slice:
 * each band's rate applies only to the part of the hammer that falls inside it, so the
 * premium never drops at a band edge (15% of the first £500,000 + 10% of the rest).
 *
 * Mirrors `BuyerPremiumTier` in `packages/db/src/schema/sales.ts`; lives in `@auction/types`
 * so non-DB consumers (validators, API, web, mobile, scripts) can share the shape without
 * pulling in `drizzle-orm`.
 */
export type BuyerPremiumTier = {
  hammerThresholdMinor: number;
  rate: string;
};

/** What a buyer's premium is: one rate on the whole hammer, or bands charged slice by slice. */
export type BuyerPremiumSchedule =
  | { kind: "flat"; rate: string }
  | { kind: "bands"; bands: readonly BuyerPremiumTier[] };

/**
 * Where a lot's premium came from:
 * - `lot`: staff set a premium on the lot itself (an override);
 * - `sale_bands` / `sale_flat`: the lot uses its sale's bands or flat rate;
 * - `standard`: the lot has no sale and no rate of its own, so the published standard applies.
 */
export const buyerPremiumSources = ["lot", "sale_bands", "sale_flat", "standard"] as const;
export type BuyerPremiumSource = (typeof buyerPremiumSources)[number];

/** Whether `value` is a `BuyerPremiumSource` (for parsing API payloads). */
export function isBuyerPremiumSource(value: unknown): value is BuyerPremiumSource {
  return typeof value === "string" && (buyerPremiumSources as readonly string[]).includes(value);
}

/** The part of a hammer that falls in one band, and that band's rate. */
export type BuyerPremiumSlice = {
  rate: string;
  /** How much of the hammer the rate is charged on, in minor units. */
  baseMinor: number;
};

/**
 * Policy that computes the buyer's premium for a given hammer price.
 *
 * Implementations live in `@auction/validators` (`FlatRateBuyerPremiumPolicy`,
 * `BandedBuyerPremiumPolicy`) and must not depend on a database client — they are
 * pure value objects.
 */
export interface BuyerPremiumPolicy {
  /**
   * Premium due on `hammerMinor` (minor units), as a non-negative integer in minor units,
   * rounded half up to the penny with integer maths.
   */
  computePremiumMinor(hammerMinor: number): number;
  /**
   * Compute on a decimal **major-currency** input (e.g. "1234.56" GBP).
   * Returns a decimal **major-currency** string with 2 d.p. ("123.46").
   */
  computePremiumMajor(hammerMajor: string): string;
  /** The rate that applies to the top slice of a hammer of `hammerMinor` ("0.1000"). */
  rateFor(hammerMinor: number): string;
  /** The slices of `hammerMinor` the premium is charged on, lowest band first; empty for 0. */
  breakdown(hammerMinor: number): BuyerPremiumSlice[];
  /** The schedule the policy charges. */
  readonly schedule: BuyerPremiumSchedule;
  /**
   * Stable identifier for logs / event payloads / audit trails.
   * Format: `flat:0.1500` | `bands:[0:0.1500,50000000:0.1000]`. Invoices raised before banded
   * pricing carry `tiered:[…]` (one rate on the whole hammer).
   */
  readonly id: string;
}
