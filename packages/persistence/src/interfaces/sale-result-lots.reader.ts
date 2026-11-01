import type { LotStatus } from "@auction/types";

/** The few lot facts a sale's results are computed from. */
export type SaleResultLotRow = {
  id: string;
  saleId: string;
  status: LotStatus;
  currentPrice: string;
  buyerPremiumRate: string;
  hasWinner: boolean;
  endTime: Date;
  extendedUntil: Date | null;
};

/** Narrow read port for public sale results (one query, no media or categories). */
export interface ISaleResultLotsReader {
  /** Every undeleted lot of the given sales; sales without lots are absent from the map. */
  listBySaleIds(saleIds: string[]): Promise<Map<string, SaleResultLotRow[]>>;
}
