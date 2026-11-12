import type { Database } from "@auction/db";
import { lot } from "@auction/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { IPublicLotResultReader } from "../interfaces/public-lot-result.reader.js";
import { lotResultPendingSql } from "../lib/lot-result-pending.sql.js";

export class DrizzlePublicLotResultReader implements IPublicLotResultReader {
  constructor(private readonly db: Database) {}

  async pendingAmong(lotIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (lotIds.length === 0) return new Set();
    const rows = await this.db
      .select({ id: lot.id })
      .from(lot)
      .where(and(inArray(lot.id, [...lotIds]), eq(lot.status, "ended"), lotResultPendingSql()));
    return new Set(rows.map((row) => row.id));
  }
}
