import type { Database } from "@auction/db";
import { lot } from "@auction/db/schema";
import { inArray } from "drizzle-orm";

/** The lot numbers LAX Bid gave its lots, by lot id. A lot without a number is left out. */
export class DrizzleLotNumberReader {
  constructor(private readonly db: Database) {}

  async numbersFor(lotIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (lotIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: lot.id, lotNumber: lot.lotNumber })
      .from(lot)
      .where(inArray(lot.id, [...lotIds]));
    return new Map(
      rows.flatMap((row) => (row.lotNumber === null ? [] : [[row.id, row.lotNumber] as const])),
    );
  }
}
