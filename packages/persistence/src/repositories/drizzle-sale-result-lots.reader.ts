import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot } from "@auction/db/schema";
import { and, inArray } from "drizzle-orm";
import type {
  ISaleResultLotsReader,
  SaleResultLotRow,
} from "../interfaces/sale-result-lots.reader.js";

export class DrizzleSaleResultLotsReader implements ISaleResultLotsReader {
  constructor(private readonly db: Database) {}

  async listBySaleIds(saleIds: string[]): Promise<Map<string, SaleResultLotRow[]>> {
    const bySale = new Map<string, SaleResultLotRow[]>();
    if (saleIds.length === 0) return bySale;
    const rows = await this.db
      .select({
        id: lot.id,
        saleId: lot.saleId,
        status: lot.status,
        currentPrice: lot.currentPrice,
        buyerPremiumRate: lot.buyerPremiumRate,
        winnerId: lot.winnerId,
        endTime: lot.endTime,
        extendedUntil: lot.extendedUntil,
      })
      .from(lot)
      .where(and(inArray(lot.saleId, saleIds), lotNotDeleted()));
    for (const row of rows) {
      if (!row.saleId) continue;
      const list = bySale.get(row.saleId) ?? [];
      list.push({
        id: row.id,
        saleId: row.saleId,
        status: row.status,
        currentPrice: row.currentPrice,
        buyerPremiumRate: row.buyerPremiumRate,
        hasWinner: row.winnerId != null,
        endTime: row.endTime,
        extendedUntil: row.extendedUntil,
      });
      bySale.set(row.saleId, list);
    }
    return bySale;
  }
}
