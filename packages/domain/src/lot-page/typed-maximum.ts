import { minorUnitsToMoneyString, parseMoneyToMinorUnits } from "../money-compare.js";
import { type NextBidLot, lotIncrement, nextBidAmount } from "./next-bid.js";

/** A maximum above this many times the high estimate (or the next bid) asks "Are you sure?". */
export const LARGE_MAXIMUM_FACTOR = 10n;

/**
 * Reads an amount a person typed: pounds with optional thousands commas, a leading "£" and up to
 * two decimals. Anything else is not an amount.
 */
export function parseTypedAmount(text: string): string | null {
  const cleaned = text.trim().replace(/^£\s*/, "").replace(/,/g, "");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(cleaned)) return null;
  const minor = parseMoneyToMinorUnits(cleaned);
  return minor > 0n ? minorUnitsToMoneyString(minor) : null;
}

export type TypedMaximum =
  /** Nothing typed yet. */
  | { kind: "empty" }
  /** Not an amount in pounds. */
  | { kind: "invalid" }
  /** Below what the lot accepts next. */
  | { kind: "below_next"; nextBid: string }
  /** A valid amount; `snapped` is the nearest valid step at or below what was typed. */
  | { kind: "ok"; typed: string; snapped: string; exact: boolean };

/**
 * Brings a typed maximum onto the lot's own steps: the next bid plus a whole number of increments.
 * It rounds down, never up, so the bidder is never committed to more than they typed.
 */
export function snapTypedMaximum(lot: NextBidLot, text: string): TypedMaximum {
  if (text.trim() === "") return { kind: "empty" };
  const typed = parseTypedAmount(text);
  if (typed === null) return { kind: "invalid" };
  const next = nextBidAmount(lot);
  const typedMinor = parseMoneyToMinorUnits(typed);
  const nextMinor = parseMoneyToMinorUnits(next);
  if (typedMinor < nextMinor) return { kind: "below_next", nextBid: next };
  const stepMinor = parseMoneyToMinorUnits(lotIncrement(lot));
  const steps = (typedMinor - nextMinor) / stepMinor;
  const snappedMinor = nextMinor + steps * stepMinor;
  return {
    kind: "ok",
    typed,
    snapped: minorUnitsToMoneyString(snappedMinor),
    exact: snappedMinor === typedMinor,
  };
}

/**
 * Whether a maximum is large enough to ask again: over ten times the high estimate, or over ten
 * times the next bid when there is no estimate. A slip of a zero costs real money.
 */
export function isLargeMaximum(input: {
  amount: string;
  estimateHigh: string | null;
  nextBid: string;
}): boolean {
  const reference = input.estimateHigh ?? input.nextBid;
  const referenceMinor = parseMoneyToMinorUnits(reference);
  const floor = parseMoneyToMinorUnits(input.nextBid);
  const base = referenceMinor > floor ? referenceMinor : floor;
  return parseMoneyToMinorUnits(input.amount) > base * LARGE_MAXIMUM_FACTOR;
}
