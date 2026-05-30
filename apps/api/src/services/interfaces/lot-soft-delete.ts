export type LotSoftDeleteGuardCounts = {
  bidCount: number;
  paymentCount: number;
  approvedRegistrationCount: number;
};

export interface ILotSoftDeleteSideEffects {
  countGuardsForLot(lotId: string, saleId: string | null): Promise<LotSoftDeleteGuardCounts>;
  countGuardsForLots(
    lots: Array<{ lotId: string; saleId: string | null }>,
  ): Promise<Map<string, LotSoftDeleteGuardCounts>>;
  softDeleteLot(input: {
    lotId: string;
    actorUserId: string;
    deletedAt: Date;
  }): Promise<void>;
}
