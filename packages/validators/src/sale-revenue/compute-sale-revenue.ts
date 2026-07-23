import type { BuyerPremiumTier } from "@auction/types";
import { buildBuyerPremiumPolicy } from "../buyer-premium.js";
import { addMoneyStrings } from "../money-compare.js";

export type SalePremiumContext = {
  buyerPremiumRate: string;
  buyerPremiumTiers: readonly BuyerPremiumTier[] | null;
};

export type SaleLotRevenueInput = {
  currentPrice: string;
  buyerPremiumRate: string | null;
};

export type SaleBidVolumeByDayAndLot = {
  dayKey: string;
  lotId: string;
  amountPence: number;
  lotBuyerPremiumRate: string | null;
};

function resolveLotRate(lotRate: string | null, saleRate: string): string {
  return lotRate?.trim() ? lotRate : saleRate;
}

function lotExpectedRevenueMajor(lot: SaleLotRevenueInput, sale: SalePremiumContext): string {
  const hammer = lot.currentPrice?.trim() ? lot.currentPrice : "0";
  const policy = buildBuyerPremiumPolicy({
    saleTiers: sale.buyerPremiumTiers,
    lotRate: resolveLotRate(lot.buyerPremiumRate, sale.buyerPremiumRate),
  });
  const premium = policy.computePremiumMajor(hammer);
  return addMoneyStrings(hammer, premium);
}

/** Tiered expected revenue across all lots in a sale (hammer + buyer premium). */
export function computeSaleExpectedRevenue(input: {
  lots: readonly SaleLotRevenueInput[];
  sale: SalePremiumContext;
}): string {
  let total = "0";
  for (const lot of input.lots) {
    total = addMoneyStrings(total, lotExpectedRevenueMajor(lot, input.sale));
  }
  return total;
}

function revenuePenceForBidVolume(row: SaleBidVolumeByDayAndLot, sale: SalePremiumContext): number {
  const hammerPence = Math.max(0, row.amountPence);
  const policy = buildBuyerPremiumPolicy({
    saleTiers: sale.buyerPremiumTiers,
    lotRate: resolveLotRate(row.lotBuyerPremiumRate, sale.buyerPremiumRate),
  });
  const premiumPence = policy.computePremiumMinor(hammerPence);
  return hammerPence + premiumPence;
}

/** Aggregate tiered revenue (hammer + premium) per UTC day from bid volume rows. */
export function composeTieredRevenueDailySeries(input: {
  rows: readonly SaleBidVolumeByDayAndLot[];
  sale: SalePremiumContext;
}): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const row of input.rows) {
    const revenuePence = revenuePenceForBidVolume(row, input.sale);
    byDay.set(row.dayKey, (byDay.get(row.dayKey) ?? 0) + revenuePence);
  }
  return byDay;
}
