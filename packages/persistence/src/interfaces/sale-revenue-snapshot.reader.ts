import type { BuyerPremiumTier } from "@auction/types";
import type { SaleLotRevenuePriceRow } from "../repositories/sale/sale-overview-kpi-trend-queries.js";

export type SalePremiumContext = {
  buyerPremiumRate: string;
  buyerPremiumTiers: BuyerPremiumTier[] | null;
};

export type SaleRevenueSnapshotData = {
  sale: SalePremiumContext;
  lots: SaleLotRevenuePriceRow[];
  totalHammerPence: number;
};

export interface ISaleRevenueSnapshotReader {
  loadSnapshot(saleId: string): Promise<SaleRevenueSnapshotData | null>;
}
