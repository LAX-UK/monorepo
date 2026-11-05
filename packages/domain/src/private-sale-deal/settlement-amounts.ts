import type { PrivateSaleDeal } from "@auction/types";
import { computeDealMoney } from "./money.js";

/** What the buyer is charged: the price plus any buyer's fee. `null` until a price is agreed. */
export function dealPaymentDueMinor(
  deal: Pick<PrivateSaleDeal, "priceMinor" | "buyerFeeBps">,
): number | null {
  if (deal.priceMinor === null) return null;
  return computeDealMoney({
    priceMinor: deal.priceMinor,
    buyerFeeBps: deal.buyerFeeBps,
    sellerCommissionBps: null,
    costsMinor: 0,
  }).totalDueMinor;
}

export type DealPayoutAmounts = {
  /** The price, which is what the payout line settles. */
  grossMinor: number;
  commissionMinor: number;
  costsMinor: number;
  /** The commission and the agreed costs, taken from the price. */
  deductionsMinor: number;
  netMinor: number;
};

/**
 * What the seller receives for a deal: the price less the commission and the agreed costs. The
 * buyer's fee is LAX's own revenue and never part of the seller's side. `null` while the price or
 * the commission is not set, so a payout is never worked out from a guess.
 */
export function dealPayoutAmounts(
  deal: Pick<PrivateSaleDeal, "priceMinor" | "sellerCommissionBps" | "costsMinor">,
): DealPayoutAmounts | null {
  if (deal.priceMinor === null || deal.sellerCommissionBps === null) return null;
  const money = computeDealMoney({
    priceMinor: deal.priceMinor,
    buyerFeeBps: 0,
    sellerCommissionBps: deal.sellerCommissionBps,
    costsMinor: deal.costsMinor,
  });
  const commissionMinor = money.sellerCommissionMinor ?? 0;
  return {
    grossMinor: money.priceMinor,
    commissionMinor,
    costsMinor: money.costsMinor,
    deductionsMinor: commissionMinor + money.costsMinor,
    netMinor: money.netToSellerMinor ?? 0,
  };
}
