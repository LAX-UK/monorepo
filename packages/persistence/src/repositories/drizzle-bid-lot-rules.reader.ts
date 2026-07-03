import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { IBidLotRulesReader } from "../interfaces/bid-lot-rules.reader.js";

export class DrizzleBidLotRulesReader implements IBidLotRulesReader {
  constructor(private readonly db: Database) {}

  async findLotBidRules(lotId: string) {
    const [row] = await this.db
      .select({
        saleId: lot.saleId,
        autoBidEnabled: lot.autoBidEnabled,
        minBidIncrement: lot.minBidIncrement,
        autoBidStepMin: lot.autoBidStepMin,
        autoBidStepMax: lot.autoBidStepMax,
        autoBidStepPresets: lot.autoBidStepPresets,
      })
      .from(lot)
      .where(and(eq(lot.id, lotId), lotNotDeleted()))
      .limit(1);
    if (!row) return null;
    return {
      saleId: row.saleId,
      autoBidEnabled: row.autoBidEnabled,
      minBidIncrement: String(row.minBidIncrement),
      autoBidStepMin: row.autoBidStepMin != null ? String(row.autoBidStepMin) : null,
      autoBidStepMax: row.autoBidStepMax != null ? String(row.autoBidStepMax) : null,
      autoBidStepPresets: row.autoBidStepPresets ?? null,
    };
  }
}
