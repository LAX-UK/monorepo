export type SaleSoftDeleteGuardCounts = {
  bidCount: number;
  paymentCount: number;
  approvedRegistrationCount: number;
};

export interface ISaleSoftDeleteSideEffects {
  countGuardsForSale(saleId: string): Promise<SaleSoftDeleteGuardCounts>;
  countGuardsForSales(saleIds: string[]): Promise<Map<string, SaleSoftDeleteGuardCounts>>;
  softDeleteCascade(input: {
    saleId: string;
    actorUserId: string;
    deletedAt: Date;
    lotIds: string[];
  }): Promise<void>;
}
