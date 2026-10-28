import type { Database } from "@auction/db";
import { lot } from "@auction/db/schema";
import { and, count, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { CurrencyCountRow, ISoldWorksReader } from "../interfaces/index.js";
import { lotCurrencySql } from "./organisation-dashboard.sql.js";

/** The organisation's sold lots in a period, with hammer totals per currency. */
export class DrizzleSoldWorksReader implements ISoldWorksReader {
  constructor(private readonly db: Database) {}

  async soldBetween(legalEntityId: string, from: Date, to: Date): Promise<CurrencyCountRow[]> {
    const rows = await this.db
      .select({
        currency: lotCurrencySql,
        count: count(),
        amount: sql<string>`coalesce(sum(${lot.currentPrice}), 0)`,
      })
      .from(lot)
      .where(
        and(
          eq(lot.sellerLegalEntityId, legalEntityId),
          eq(lot.status, "ended"),
          isNotNull(lot.winnerId),
          isNull(lot.deletedAt),
          gte(lot.endTime, from),
          lt(lot.endTime, to),
        ),
      )
      .groupBy(lotCurrencySql);
    return rows.map((row) => ({
      currency: row.currency,
      count: Number(row.count),
      amount: String(row.amount),
    }));
  }
}
