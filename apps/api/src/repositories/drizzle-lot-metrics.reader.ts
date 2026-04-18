import type { Database } from "@auction/db";
import { lot } from "@auction/db/schema";
import { and, count, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type {
  DateRange,
  ILotMetricsReader,
  LotMetricPoint,
} from "../services/interfaces/analytics.js";

export class DrizzleLotMetricsReader implements ILotMetricsReader {
  constructor(private readonly db: Database) {}

  async getActiveCount(): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(lot).where(eq(lot.status, "active"));
    return Number(row?.n ?? 0);
  }

  async getCompletedByDateRange(range: DateRange): Promise<LotMetricPoint[]> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${lot.endTime}), 'YYYY-MM-DD')`.as("d"),
        count: sql<number>`count(*)::int`.as("c"),
      })
      .from(lot)
      .where(
        and(eq(lot.status, "ended"), gte(lot.endTime, range.start), lte(lot.endTime, range.end)),
      )
      .groupBy(sql`date_trunc('day', ${lot.endTime})`)
      .orderBy(sql`date_trunc('day', ${lot.endTime})`);

    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  async getConversionRate(range: DateRange): Promise<{ ended: number; withWinner: number }> {
    const [endedRow] = await this.db
      .select({ n: count() })
      .from(lot)
      .where(
        and(eq(lot.status, "ended"), gte(lot.endTime, range.start), lte(lot.endTime, range.end)),
      );

    const [winRow] = await this.db
      .select({ n: count() })
      .from(lot)
      .where(
        and(
          eq(lot.status, "ended"),
          isNotNull(lot.winnerId),
          gte(lot.endTime, range.start),
          lte(lot.endTime, range.end),
        ),
      );

    return { ended: Number(endedRow?.n ?? 0), withWinner: Number(winRow?.n ?? 0) };
  }
}
