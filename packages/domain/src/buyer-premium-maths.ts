import type { BuyerPremiumSchedule, BuyerPremiumSource, BuyerPremiumTier } from "@auction/types";

/*
 * The buyer's premium maths, in one place for every package: the published standard, which
 * premium a lot charges, and the premium on a hammer, worked in integers and rounded half up.
 * `@auction/validators` wraps these as policies; the lot page's bid summary reads them directly.
 */

/**
 * The standard buyer's premium in the published Conditions of Sale (clause 11): 15% of the
 * hammer up to £500,000 and 10% of the part above. The one definition every default reads:
 * new sales, the sale form, the seed and the buyer-facing copy.
 */
export const STANDARD_BUYER_PREMIUM_BANDS: readonly BuyerPremiumTier[] = Object.freeze([
  Object.freeze({ hammerThresholdMinor: 0, rate: "0.1500" }),
  Object.freeze({ hammerThresholdMinor: 50_000_000, rate: "0.1000" }),
]);

/** The standard premium as a schedule. */
export const STANDARD_BUYER_PREMIUM: BuyerPremiumSchedule = Object.freeze({
  kind: "bands",
  bands: STANDARD_BUYER_PREMIUM_BANDS,
});

const RATE_PATTERN = /^\d(\.\d{1,4})?$/u;
/** Rates are held to 4 d.p., so they are whole ten-thousandths. */
const RATE_SCALE = 10_000n;

/**
 * A rate ("0.1500") as whole ten-thousandths (1500n), or `null` when it is not a decimal from
 * 0 to 1 with up to four places. Parsed from the string, never through a float.
 */
export function rateToTenThousandths(rate: string | null | undefined): bigint | null {
  const text = (rate ?? "").trim();
  if (!RATE_PATTERN.test(text)) return null;
  const [whole = "0", fraction = ""] = text.split(".");
  const value = BigInt(whole) * RATE_SCALE + BigInt(fraction.padEnd(4, "0"));
  return value <= RATE_SCALE ? value : null;
}

/** Whether `rate` is a usable premium rate: a decimal from 0 to 1 with up to four places. */
export function isBuyerPremiumRate(rate: string | null | undefined): rate is string {
  return rateToTenThousandths(rate) !== null;
}

/** The bands ascending by threshold (a copy; the input is left as it is). */
export function sortedPremiumBands(bands: readonly BuyerPremiumTier[]): BuyerPremiumTier[] {
  return [...bands]
    .sort((a, b) => a.hammerThresholdMinor - b.hammerThresholdMinor)
    .map((band) => ({ hammerThresholdMinor: band.hammerThresholdMinor, rate: band.rate }));
}

/** One slice of a hammer and the rate charged on it, in minor units. */
export type PremiumSliceMinor = { rate: string; baseMinor: bigint };

/**
 * The slices of `hammerMinor` a premium is charged on, lowest band first. A flat rate is one
 * slice of the whole hammer; bands give each rate only the part of the hammer inside its band.
 */
export function premiumSlicesMinor(
  schedule: BuyerPremiumSchedule,
  hammerMinor: bigint,
): PremiumSliceMinor[] {
  if (hammerMinor <= 0n) return [];
  if (schedule.kind === "flat") return [{ rate: schedule.rate, baseMinor: hammerMinor }];
  const bands = sortedPremiumBands(schedule.bands);
  const slices: PremiumSliceMinor[] = [];
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (!band) break;
    const from = BigInt(band.hammerThresholdMinor);
    if (hammerMinor <= from) break;
    const next = bands[i + 1];
    const to = next ? BigInt(next.hammerThresholdMinor) : null;
    const top = to !== null && to < hammerMinor ? to : hammerMinor;
    slices.push({ rate: band.rate, baseMinor: top - from });
  }
  return slices;
}

/**
 * The premium on `hammerMinor` under `schedule`, in minor units. The slices are added exactly
 * (in ten-thousandths of a penny) and the total is rounded once, half up to the penny, as every
 * LAX money figure is. A rate that is not a valid premium rate charges nothing.
 */
export function premiumMinorFor(schedule: BuyerPremiumSchedule, hammerMinor: bigint): bigint {
  let exact = 0n;
  for (const slice of premiumSlicesMinor(schedule, hammerMinor)) {
    exact += slice.baseMinor * (rateToTenThousandths(slice.rate) ?? 0n);
  }
  return (exact + RATE_SCALE / 2n) / RATE_SCALE;
}

/** The parts of a sale the premium is read from. */
export type BuyerPremiumSaleTerms = {
  buyerPremiumRate: string;
  buyerPremiumTiers: readonly BuyerPremiumTier[] | null | undefined;
};

/** The sale's premium on its own: its bands when it has any, else its flat rate. */
export function saleBuyerPremiumSchedule(sale: BuyerPremiumSaleTerms): {
  source: "sale_bands" | "sale_flat";
  schedule: BuyerPremiumSchedule;
} {
  const bands = sale.buyerPremiumTiers;
  if (bands && bands.length > 0)
    return { source: "sale_bands", schedule: { kind: "bands", bands } };
  return { source: "sale_flat", schedule: { kind: "flat", rate: sale.buyerPremiumRate } };
}

/**
 * The one rule for which premium a lot charges, used by every surface that shows or charges it:
 *
 * 1. the lot's own premium, when staff set one;
 * 2. otherwise the sale's bands;
 * 3. otherwise the sale's flat rate;
 * 4. a lot outside any sale, with no premium of its own, pays the published standard.
 *
 * Nothing falls back to a hidden default rate.
 */
export function resolveBuyerPremiumSchedule(input: {
  lotRate: string | null | undefined;
  sale: BuyerPremiumSaleTerms | null | undefined;
}): { source: BuyerPremiumSource; schedule: BuyerPremiumSchedule } {
  if (isBuyerPremiumRate(input.lotRate)) {
    return { source: "lot", schedule: { kind: "flat", rate: input.lotRate } };
  }
  if (input.sale) return saleBuyerPremiumSchedule(input.sale);
  return { source: "standard", schedule: STANDARD_BUYER_PREMIUM };
}
