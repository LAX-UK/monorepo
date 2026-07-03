import type { SaleSoftDeleteGuardCounts } from "../../services/interfaces/sale-soft-delete.js";

export interface ISaleSoftDeleteGuardReader {
  countGuardsForSale(saleId: string): Promise<SaleSoftDeleteGuardCounts>;
  countGuardsForSales(saleIds: string[]): Promise<Map<string, SaleSoftDeleteGuardCounts>>;
}
