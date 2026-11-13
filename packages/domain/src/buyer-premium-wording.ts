import type { BuyerPremiumSchedule, BuyerPremiumSlice } from "@auction/types";
import { premiumMinorFor, rateToTenThousandths } from "./buyer-premium-maths.js";

/*
 * How LAX says a buyer's premium in words, for staff and buyers alike. One wording, so the sale
 * form, the lot page and the invoice line never disagree with each other or with the Conditions.
 */

/** "15%", "12.5%": a rate as a percentage, without trailing zeros. */
export function formatPremiumPercent(rate: string): string {
  const units = rateToTenThousandths(rate);
  if (units === null) return "0%";
  // Ten-thousandths are hundredths of a percent.
  const whole = units / 100n;
  const hundredths = (units % 100n).toString().padStart(2, "0").replace(/0+$/u, "");
  return hundredths ? `${whole}.${hundredths}%` : `${whole}%`;
}

/** "£500,000" for whole pounds, "£499,999.99" otherwise. Pounds sterling, from pence. */
export function formatPremiumMoney(minor: number): string {
  const pence = Number.isSafeInteger(minor) && minor > 0 ? BigInt(minor) : 0n;
  const pounds = (pence / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const rest = pence % 100n;
  return rest === 0n ? `£${pounds}` : `£${pounds}.${rest.toString().padStart(2, "0")}`;
}

/**
 * The premium in plain words:
 * - flat: "25% on the hammer";
 * - two bands: "15% up to £500,000, then 10% on the part above";
 * - more: "20% up to £100,000, 15% from £100,000 to £500,000, then 10% on the part above".
 */
export function describeBuyerPremium(schedule: BuyerPremiumSchedule): string {
  if (schedule.kind === "flat") return `${formatPremiumPercent(schedule.rate)} on the hammer`;
  const bands = [...schedule.bands].sort((a, b) => a.hammerThresholdMinor - b.hammerThresholdMinor);
  const [first] = bands;
  if (!first) return "None";
  if (bands.length === 1) return `${formatPremiumPercent(first.rate)} on the hammer`;
  return bands
    .map((band, i) => {
      const rate = formatPremiumPercent(band.rate);
      const next = bands[i + 1];
      // "then … on the part above" so the top band never reads as the rate on the whole hammer.
      if (!next) return `then ${rate} on the part above`;
      const upTo = formatPremiumMoney(next.hammerThresholdMinor);
      return i === 0
        ? `${rate} up to ${upTo}`
        : `${rate} from ${formatPremiumMoney(band.hammerThresholdMinor)} to ${upTo}`;
    })
    .join(", ");
}

/**
 * How a premium was worked out, slice by slice: "15% of £500,000 + 10% of £100,000".
 * Empty when nothing was charged.
 */
export function describeBuyerPremiumBreakdown(slices: readonly BuyerPremiumSlice[]): string {
  return slices
    .filter((slice) => slice.baseMinor > 0)
    .map((slice) => `${formatPremiumPercent(slice.rate)} of ${formatPremiumMoney(slice.baseMinor)}`)
    .join(" + ");
}

/** "On a £600,000 hammer the buyer's premium is £85,000." (a whole sentence, with its full stop). */
export function buyerPremiumWorkedExample(
  schedule: BuyerPremiumSchedule,
  hammerMinor: number,
): string {
  const hammer = Number.isSafeInteger(hammerMinor) && hammerMinor > 0 ? BigInt(hammerMinor) : 0n;
  const premium = Number(premiumMinorFor(schedule, hammer));
  return `On a ${formatPremiumMoney(hammerMinor)} hammer the buyer's premium is ${formatPremiumMoney(premium)}.`;
}

/**
 * The invoice line for the premium: "Buyer's premium (25%)" for one rate, or the slices for
 * bands, "Buyer's premium (15% of £500,000 + 10% of £100,000)".
 */
export function buyerPremiumLineLabel(
  schedule: BuyerPremiumSchedule,
  slices: readonly BuyerPremiumSlice[],
): string {
  if (schedule.kind === "flat") return `Buyer's premium (${formatPremiumPercent(schedule.rate)})`;
  const breakdown = describeBuyerPremiumBreakdown(slices);
  return breakdown ? `Buyer's premium (${breakdown})` : "Buyer's premium";
}
