import type { LotSoftDeleteGuardCounts } from "../../services/interfaces/lot-soft-delete.js";

export interface ILotSoftDeleteGuardReader {
  countGuardsForLot(lotId: string, saleId: string | null): Promise<LotSoftDeleteGuardCounts>;
  countGuardsForLots(
    lots: Array<{ lotId: string; saleId: string | null }>,
  ): Promise<Map<string, LotSoftDeleteGuardCounts>>;
}
