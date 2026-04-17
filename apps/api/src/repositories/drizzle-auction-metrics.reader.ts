import type { Database } from "@auction/db";
import { auction } from "@auction/db/schema";
import { and, count, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import type {
  AuctionMetricPoint,
  DateRange,
  IAuctionMetricsReader,
} from "../services/interfaces/analytics.js";

export class DrizzleAuctionMetricsReader implements IAuctionMetricsReader {
  constructor(private readonly db: Database) {}

  async getActiveCount(): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(auction)
      .where(eq(auction.status, "active"));
    return Number(row?.n ?? 0);
  }

  async getCompletedByDateRange(range: DateRange): Promise<AuctionMetricPoint[]> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${auction.endTime}), 'YYYY-MM-DD')`.as("d"),
        count: sql<number>`count(*)::int`.as("c"),
      })
      .from(auction)
      .where(
        and(
          eq(auction.status, "ended"),
          gte(auction.endTime, range.start),
          lte(auction.endTime, range.end),
        ),
      )
      .groupBy(sql`date_trunc('day', ${auction.endTime})`)
      .orderBy(sql`date_trunc('day', ${auction.endTime})`);

    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  async getConversionRate(range: DateRange): Promise<{ ended: number; withWinner: number }> {
    const [endedRow] = await this.db
      .select({ n: count() })
      .from(auction)
      .where(
        and(
          eq(auction.status, "ended"),
          gte(auction.endTime, range.start),
          lte(auction.endTime, range.end),
        ),
      );

    const [winRow] = await this.db
      .select({ n: count() })
      .from(auction)
      .where(
        and(
          eq(auction.status, "ended"),
          isNotNull(auction.winnerId),
          gte(auction.endTime, range.start),
          lte(auction.endTime, range.end),
        ),
      );

    return { ended: Number(endedRow?.n ?? 0), withWinner: Number(winRow?.n ?? 0) };
  }
}
