import { minorUnitsToMoneyString, parseMoneyToMinorUnits } from "../money-compare.js";

/** One band of a banded premium: the rate applies to the whole hammer from this amount up. */
export type BuyersPremiumBand = {
  /** The lowest hammer, in major units, the band covers. */
  fromHammer: string;
  /** A decimal fraction as a string ("0.25" is 25%). */
  rate: string;
};

/**
 * The buyer's premium a lot carries, in the shape a client needs to show the premium and the
 * total for any amount: one rate, or bands where the band reached by the hammer sets the rate on
 * the whole hammer.
 */
export type BuyersPremiumTerms =
  | { kind: "flat"; rate: string }
  | { kind: "banded"; bands: readonly BuyersPremiumBand[] };

/** A stored band keeps its threshold in minor units; the wire shape uses major units. */
export function bandFromStored(tier: {
  hammerThresholdMinor: number;
  rate: string;
}): BuyersPremiumBand {
  return {
    fromHammer: minorUnitsToMoneyString(BigInt(Math.round(tier.hammerThresholdMinor))),
    rate: tier.rate,
  };
}

export function buyersPremiumTerms(input: {
  lotRate: string;
  bands: readonly { hammerThresholdMinor: number; rate: string }[] | null | undefined;
}): BuyersPremiumTerms {
  if (input.bands && input.bands.length > 0) {
    return {
      kind: "banded",
      bands: [...input.bands]
        .sort((a, b) => a.hammerThresholdMinor - b.hammerThresholdMinor)
        .map(bandFromStored),
    };
  }
  return { kind: "flat", rate: input.lotRate };
}

/** The rate that applies to a hammer under the terms, as a decimal fraction string. */
export function premiumRateFor(terms: BuyersPremiumTerms, hammer: string): string {
  if (terms.kind === "flat") return terms.rate;
  const hammerMinor = parseMoneyToMinorUnits(hammer);
  let rate = terms.bands[0]?.rate ?? "0";
  for (const band of terms.bands) {
    if (hammerMinor >= parseMoneyToMinorUnits(band.fromHammer)) rate = band.rate;
    else break;
  }
  return rate;
}
