import { type CurrencyTotal, sumByCurrency } from "./currency-totals.js";
import type { LaxCostLineV1, LaxPortfolioItemV1 } from "./lax-portfolio-contract.v1.js";

export type PortfolioHeaderVm = {
  worksOwned: number;
  inSaleOrConsigned: number;
  awaitingPayment: number;
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

/**
 * "Paid so far" counts only works that have been paid for: an invoice still awaiting payment
 * is a liability, not a payment. It is a fact in the currency paid, not a valuation.
 */
export function buildPortfolioHeader(items: readonly LaxPortfolioItemV1[]): PortfolioHeaderVm {
  const count = (...statuses: LaxPortfolioItemV1["status"][]) =>
    items.filter((item) => statuses.includes(item.status)).length;
  return {
    worksOwned: count("owned", "awaiting_shipment"),
    inSaleOrConsigned: count("consigned", "in_sale"),
    awaitingPayment: count("awaiting_payment"),
    paidSoFar: sumByCurrency(
      items.filter((item) => item.status !== "awaiting_payment").flatMap(costBasisLines),
    ),
  };
}
