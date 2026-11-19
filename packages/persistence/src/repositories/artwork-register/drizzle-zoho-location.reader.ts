import type { Database } from "@auction/db";
import { artworkRegister as register } from "@auction/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  IZohoLocationSourceReader,
  RegisterLocationSource,
} from "../../interfaces/zoho-location.js";
import { DrizzleStockLocationStore } from "./drizzle-stock-location.store.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Register and stock location reads for the Zoho `LAX_Location` mirror. The current location is
 * read through the stock location store, so the mirror and LAX Admin cannot disagree on it.
 */
export class DrizzleZohoLocationSourceReader implements IZohoLocationSourceReader {
  private readonly locations: DrizzleStockLocationStore;

  constructor(private readonly db: Database) {
    this.locations = new DrizzleStockLocationStore(db);
  }

  async read(registerIds: readonly string[]): Promise<RegisterLocationSource[]> {
    const ids = [...new Set(registerIds)].filter((id) => UUID.test(id));
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({
        registerId: register.id,
        stockCode: register.stockCode,
        zohoProductId: register.zohoProductId,
      })
      .from(register)
      .where(and(inArray(register.id, ids), eq(register.kind, "original")))
      .orderBy(asc(register.id));
    if (rows.length === 0) return [];
    const current = await this.locations.currentLocations(rows.map((row) => row.registerId));
    return rows.map((row) => ({
      ...row,
      location: current.get(row.registerId)?.location ?? null,
    }));
  }
}
