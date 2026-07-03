export type LotSoftDeleteGuardCounts = {
  bidCount: number;
  paymentCount: number;
  approvedRegistrationCount: number;
};

export interface ILotSoftDeleteGuardReader {
  countGuardsForLot(lotId: string, saleId: string | null): Promise<LotSoftDeleteGuardCounts>;
  countGuardsForLots(
    lots: Array<{ lotId: string; saleId: string | null }>,
  ): Promise<Map<string, LotSoftDeleteGuardCounts>>;
}
