import { minorUnitsToMoneyString, parseMoneyToMinorUnits } from "../money-compare.js";
import { type BuyersPremiumTerms, premiumRateFor } from "./buyers-premium.js";

/** What winning at a given hammer would cost: the hammer, the premium on it and the total. */
export type BidSummary = {
  hammer: string;
  /** The rate the premium was worked at, as a decimal fraction ("0.25"). */
  rate: string;
  /** The rate as a percentage for the page to print ("25%"); `null` when there is no premium. */
  percentLabel: string | null;
  premium: string;
  total: string;
};

/** Half-way cases round to the even penny, as the premium is charged. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

function premiumMinorFor(hammerMinor: bigint, rate: string): bigint {
  const rateNumber = Number.parseFloat(rate);
  if (hammerMinor <= 0n || !Number.isFinite(rateNumber) || rateNumber <= 0) return 0n;
  return BigInt(roundHalfEven(Number(hammerMinor) * rateNumber));
}

function percentOf(rate: string): string | null {
  const percent = Number.parseFloat(rate) * 100;
  return Number.isFinite(percent) && percent > 0 ? `${Number(percent.toFixed(2))}%` : null;
}

/**
 * The premium and the total if the hammer lands on `hammer`, worked from the terms the server
 * sent with the lot, by the same rule the invoice uses. The page never invents a rate.
 */
export function bidSummary(terms: BuyersPremiumTerms, hammer: string): BidSummary {
  const hammerMinor = parseMoneyToMinorUnits(hammer);
  const rate = premiumRateFor(terms, hammer);
  const premiumMinor = premiumMinorFor(hammerMinor, rate);
  return {
    hammer: minorUnitsToMoneyString(hammerMinor),
    rate,
    percentLabel: percentOf(rate),
    premium: minorUnitsToMoneyString(premiumMinor),
    total: minorUnitsToMoneyString(hammerMinor + premiumMinor),
  };
}
