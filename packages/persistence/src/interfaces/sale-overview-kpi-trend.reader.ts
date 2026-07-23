export type SaleBidVolumeByDayAndLotRow = {
  dayKey: string;
  lotId: string;
  amountPence: number;
  lotBuyerPremiumRate: string | null;
};

/** Raw daily signals for a single sale — batched in one reader call. */
export type SaleOverviewKpiDailySignals = {
  lotsAddedByDay: Map<string, number>;
  estimateAddedByDayPence: Map<string, number>;
  bidAmountByDayPence: Map<string, number>;
  registrationsByDay: Map<string, number>;
  distinctBiddersByDay: Map<string, number>;
  bidVolumeByDayAndLot: SaleBidVolumeByDayAndLotRow[];
};

export interface ISaleOverviewKpiTrendReader {
  loadAllSignals(saleId: string, rangeStart: Date): Promise<SaleOverviewKpiDailySignals>;
}
