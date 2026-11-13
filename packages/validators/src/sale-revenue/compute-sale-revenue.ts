import type { BuyerPremiumTier } from "@auction/types";
import { resolveBuyerPremium } from "../buyer-premium.js";
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

function lotExpectedRevenueMajor(lot: SaleLotRevenueInput, sale: SalePremiumContext): string {
  const hammer = lot.currentPrice?.trim() ? lot.currentPrice : "0";
  const { policy } = resolveBuyerPremium({ lotRate: lot.buyerPremiumRate, sale });
  const premium = policy.computePremiumMajor(hammer);
  return addMoneyStrings(hammer, premium);
}

/** Expected revenue across all lots in a sale (hammer + each lot's resolved buyer's premium). */
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
  const { policy } = resolveBuyerPremium({ lotRate: row.lotBuyerPremiumRate, sale });
  const premiumPence = policy.computePremiumMinor(hammerPence);
  return hammerPence + premiumPence;
}

/** Revenue (hammer + each lot's resolved premium) per UTC day from bid volume rows. */
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
