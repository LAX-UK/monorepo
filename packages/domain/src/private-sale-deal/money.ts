import type { PrivateSaleDealMoney } from "@auction/types";

export type DealMoneyInput = {
  priceMinor: number;
  buyerFeeBps: number;
  sellerCommissionBps: number | null;
  costsMinor: number;
};

/** Basis points of an amount in pence, rounded half up. */
export function basisPointsOf(amountMinor: number, bps: number): number {
  return Math.floor((amountMinor * bps + 5_000) / 10_000);
}

/**
 * The money lines of a deal, shared by the staff record, the client rows and the invoice.
 * The buyer pays the price plus any buyer's fee; the seller receives the price less their
 * commission and agreed costs. VAT is not computed here: finance chooses the treatment and the
 * invoice applies it.
 */
export function computeDealMoney(input: DealMoneyInput): PrivateSaleDealMoney {
  const buyerFeeMinor = basisPointsOf(input.priceMinor, input.buyerFeeBps);
  const sellerCommissionMinor =
    input.sellerCommissionBps === null
      ? null
      : basisPointsOf(input.priceMinor, input.sellerCommissionBps);
  return {
    priceMinor: input.priceMinor,
    buyerFeeMinor,
    totalDueMinor: input.priceMinor + buyerFeeMinor,
    sellerCommissionMinor,
    costsMinor: input.costsMinor,
    netToSellerMinor:
      sellerCommissionMinor === null
        ? null
        : input.priceMinor - sellerCommissionMinor - input.costsMinor,
  };
}
