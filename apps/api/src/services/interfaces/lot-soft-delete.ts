export type LotSoftDeleteGuardCounts = {
  bidCount: number;
  paymentCount: number;
  approvedRegistrationCount: number;
};

export interface ILotSoftDeleteSideEffects {
  countGuardsForLot(lotId: string, saleId: string | null): Promise<LotSoftDeleteGuardCounts>;
  softDeleteLot(input: {
    lotId: string;
    actorUserId: string;
    deletedAt: Date;
  }): Promise<void>;
}
