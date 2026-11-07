import { type CurrencyTotal, sumByCurrency } from "./currency-totals.js";
import type { LaxCostLineV1, LaxPortfolioItemV1 } from "./lax-portfolio-contract.v1.js";

export type PortfolioHeaderVm = {
  worksOwned: number;
  inSaleOrConsigned: number;
  awaitingPayment: number;
  /** What those works come to in total, one subtotal per currency; empty when nothing is owed. */
  totalDue: CurrencyTotal[];
  /** Works awaiting payment whose payment waits on account checks. */
  inReview: number;
  /** One subtotal per currency; empty when nothing has been paid. Never summed across currencies. */
  paidSoFar: CurrencyTotal[];
};

/**
 * The cost basis of a work: everything paid for it except shipping, which is shown separately
 * so a delivery charge never inflates what the work itself cost.
 */
export function costBasisLines(item: LaxPortfolioItemV1): LaxCostLineV1[] {
  return item.paid.lines.filter((line) => line.kind !== "shipping");
}

/** Whether the work has been paid for: not owed, and not a payment still being confirmed. */
export function isPaidFor(item: LaxPortfolioItemV1): boolean {
  return item.status !== "awaiting_payment" && item.status !== "payment_confirming";
}

/**
 * What was paid for a work and kept: its cost lines once it has been paid for, none before. An
 * invoice still awaiting payment is a liability and a payment still being confirmed is not
 * settled. Delivery counts, because it was paid, and money refunded is already off the lines, so
 * the lines add up to what Money reports as paid less refunded. Every "paid" figure reads this.
 */
export function paidLines(item: LaxPortfolioItemV1): LaxCostLineV1[] {
  return isPaidFor(item) ? item.paid.lines : [];
}

/**
 * "Paid so far" is net: the money paid and kept, per currency, the same figure Portfolio, Home
 * and Money show. It is a fact in the currency paid, not a valuation.
 */
export function buildPortfolioHeader(items: readonly LaxPortfolioItemV1[]): PortfolioHeaderVm {
  const count = (...statuses: LaxPortfolioItemV1["status"][]) =>
    items.filter((item) => statuses.includes(item.status)).length;
  return {
    worksOwned: count("owned", "awaiting_shipment"),
    inSaleOrConsigned: count("consigned", "in_sale"),
    awaitingPayment: count("awaiting_payment"),
    totalDue: sumByCurrency(
      items.flatMap((item) => (item.status === "awaiting_payment" && item.owed ? [item.owed] : [])),
    ),
    inReview: items.filter(
      (item) => item.status === "awaiting_payment" && item.owed?.state === "in_review",
    ).length,
    paidSoFar: sumByCurrency(items.flatMap(paidLines)),
  };
}
