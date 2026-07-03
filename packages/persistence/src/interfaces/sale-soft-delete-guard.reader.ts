export type SaleSoftDeleteGuardCounts = {
  bidCount: number;
  paymentCount: number;
  approvedRegistrationCount: number;
};

export interface ISaleSoftDeleteGuardReader {
  countGuardsForSale(saleId: string): Promise<SaleSoftDeleteGuardCounts>;
  countGuardsForSales(saleIds: string[]): Promise<Map<string, SaleSoftDeleteGuardCounts>>;
}
