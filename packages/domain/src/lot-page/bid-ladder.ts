import { moneyGt, moneyGte } from "../money-compare.js";

/**
 * The amounts an agent can still commit to under their limit: everything the limit covers, lowest
 * first. A person with no limit keeps the whole ladder.
 */
export function amountsWithinLimit(amounts: readonly string[], limitLeft: string | null): string[] {
  if (limitLeft === null) return [...amounts];
  return amounts.filter((amount) => !moneyGt(amount, limitLeft));
}

/** Whether the limit covers at least the amount asked; no limit covers everything. */
export function limitCovers(limitLeft: string | null, amount: string): boolean {
  return limitLeft === null || moneyGte(limitLeft, amount);
}

/**
 * The maximum to keep when the ladder moves under the bidder: their choice while it is still on
 * the ladder, otherwise the lowest amount offered, so the field never shows an amount that cannot
 * be bid.
 */
export function keepMaximum(amounts: readonly string[], chosen: string | null): string | null {
  if (chosen !== null && amounts.includes(chosen)) return chosen;
  return amounts[0] ?? null;
}
