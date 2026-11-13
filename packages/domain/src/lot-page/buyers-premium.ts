import type { BuyerPremiumSchedule, BuyerPremiumSource } from "@auction/types";
import {
  type BuyerPremiumSaleTerms,
  premiumSlicesMinor,
  resolveBuyerPremiumSchedule,
} from "../buyer-premium-maths.js";
import { describeBuyerPremium } from "../buyer-premium-wording.js";
import { minorUnitsToMoneyString, parseMoneyToMinorUnits } from "../money-compare.js";

/** One band of a banded premium: the rate applies to the part of the hammer from here up. */
export type BuyersPremiumBand = {
  /** The lowest hammer, in major units, the band covers. */
  fromHammer: string;
  /** A decimal fraction as a string ("0.25" is 25%). */
  rate: string;
};

/**
 * The buyer's premium a lot charges, in the shape a client needs to show the premium and the
 * total for any amount: one rate, or bands charged slice by slice. `source` says whether it is
 * the lot's own premium or its sale's (see `resolveBuyerPremiumSchedule`).
 */
export type BuyersPremiumTerms =
  | { kind: "flat"; rate: string; source?: BuyerPremiumSource }
  | { kind: "banded"; bands: readonly BuyersPremiumBand[]; source?: BuyerPremiumSource };

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

/** The premium a lot charges (its own, else its sale's), in the wire shape. */
export function buyersPremiumTerms(input: {
  lotRate: string | null | undefined;
  sale: BuyerPremiumSaleTerms | null | undefined;
}): BuyersPremiumTerms {
  const { source, schedule } = resolveBuyerPremiumSchedule(input);
  if (schedule.kind === "bands") {
    return {
      kind: "banded",
      bands: [...schedule.bands]
        .sort((a, b) => a.hammerThresholdMinor - b.hammerThresholdMinor)
        .map(bandFromStored),
      source,
    };
  }
  return { kind: "flat", rate: schedule.rate, source };
}

/** The terms as a schedule, for the shared maths and wording. */
export function scheduleOfTerms(terms: BuyersPremiumTerms): BuyerPremiumSchedule {
  if (terms.kind === "flat") return { kind: "flat", rate: terms.rate };
  return {
    kind: "bands",
    bands: terms.bands.map((band) => ({
      hammerThresholdMinor: Number(parseMoneyToMinorUnits(band.fromHammer)),
      rate: band.rate,
    })),
  };
}

/** The terms in plain words: "15% up to £500,000, 10% above", "25% on the hammer". */
export function describeBuyersPremiumTerms(terms: BuyersPremiumTerms): string {
  return describeBuyerPremium(scheduleOfTerms(terms));
}

/** The rate charged on the top slice of `hammer`, as a decimal fraction string. */
export function premiumRateFor(terms: BuyersPremiumTerms, hammer: string): string {
  if (terms.kind === "flat") return terms.rate;
  const slices = premiumSlicesMinor(scheduleOfTerms(terms), parseMoneyToMinorUnits(hammer));
  return slices[slices.length - 1]?.rate ?? terms.bands[0]?.rate ?? "0";
}
