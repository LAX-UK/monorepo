import { premiumMinorFor, premiumSlicesMinor } from "../buyer-premium-maths.js";
import { describeBuyerPremiumBreakdown, formatPremiumPercent } from "../buyer-premium-wording.js";
import { minorUnitsToMoneyString, parseMoneyToMinorUnits } from "../money-compare.js";
import { type BuyersPremiumTerms, premiumRateFor, scheduleOfTerms } from "./buyers-premium.js";

/** What winning at a given hammer would cost: the hammer, the premium on it and the total. */
export type BidSummary = {
  hammer: string;
  /** The rate charged on the top slice of the hammer, as a decimal fraction ("0.25"). */
  rate: string;
  /**
   * How the premium is worked out, for the page to print: "25%" for one rate, or the slices for
   * bands ("15% of £500,000 + 10% of £100,000"); `null` when there is no premium.
   */
  percentLabel: string | null;
  premium: string;
  total: string;
};

/**
 * The premium and the total if the hammer lands on `hammer`, worked from the terms the server
 * sent with the lot, by the same maths the invoice uses (slice by slice, rounded half up to the
 * penny in integers). The page never invents a rate.
 */
export function bidSummary(terms: BuyersPremiumTerms, hammer: string): BidSummary {
  const hammerMinor = parseMoneyToMinorUnits(hammer);
  const schedule = scheduleOfTerms(terms);
  const premiumMinor = hammerMinor > 0n ? premiumMinorFor(schedule, hammerMinor) : 0n;
  const rate = premiumRateFor(terms, hammer);
  const slices = premiumSlicesMinor(schedule, hammerMinor).map((slice) => ({
    rate: slice.rate,
    baseMinor: Number(slice.baseMinor),
  }));
  const percentLabel =
    slices.length > 1 ? describeBuyerPremiumBreakdown(slices) : positivePercent(rate);
  return {
    hammer: minorUnitsToMoneyString(hammerMinor),
    rate,
    percentLabel,
    premium: minorUnitsToMoneyString(premiumMinor),
    total: minorUnitsToMoneyString(hammerMinor + premiumMinor),
  };
}

function positivePercent(rate: string): string | null {
  const label = formatPremiumPercent(rate);
  return label === "0%" ? null : label;
}
