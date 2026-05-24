export type SaleSoftDeleteGuardCounts = {
  bidCount: number;
  paymentCount: number;
  approvedRegistrationCount: number;
};

export interface ISaleSoftDeleteSideEffects {
  countGuardsForSale(saleId: string): Promise<SaleSoftDeleteGuardCounts>;
  softDeleteCascade(input: {
    saleId: string;
    actorUserId: string;
    deletedAt: Date;
    lotIds: string[];
  }): Promise<void>;
}
