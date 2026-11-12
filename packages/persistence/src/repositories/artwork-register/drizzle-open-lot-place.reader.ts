import type { Database } from "@auction/db";
import { lot, sale } from "@auction/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { IOpenLotPlaceReader, OpenLotPlace } from "../../interfaces/deal-artwork-search.js";

const OPEN_LOT_STATUSES = ["draft", "scheduled", "active"] as const;

export class DrizzleOpenLotPlaceReader implements IOpenLotPlaceReader {
  constructor(private readonly db: Database) {}

  async listOpenLotPlaces(registerIds: readonly string[]): Promise<OpenLotPlace[]> {
    if (registerIds.length === 0) return [];
    const rows = await this.db
      .select({
        registerId: lot.artworkRegisterId,
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        saleTitle: sale.title,
        status: lot.status,
      })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          inArray(lot.artworkRegisterId, [...registerIds]),
          isNull(lot.deletedAt),
          inArray(lot.status, [...OPEN_LOT_STATUSES]),
        ),
      )
      .orderBy(asc(lot.createdAt), asc(lot.id));
    const first = new Map<string, OpenLotPlace>();
    for (const row of rows) {
      if (!row.registerId || first.has(row.registerId)) continue;
      first.set(row.registerId, {
        registerId: row.registerId,
        lotId: row.lotId,
        lotNumber: row.lotNumber,
        saleTitle: row.saleTitle,
        status: row.status as OpenLotPlace["status"],
      });
    }
    return [...first.values()];
  }
}
