import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import { and, avg, gte, inArray, lte, sql } from "drizzle-orm";
import type {
  DateRange,
  IPaymentMetricsReader,
  RevenueMetricPoint,
} from "../interfaces/metrics.reader.js";

export class DrizzlePaymentMetricsReader implements IPaymentMetricsReader {
  constructor(private readonly db: Database) {}

  async getRevenueByDateRange(range: DateRange): Promise<RevenueMetricPoint[]> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${payment.createdAt}), 'YYYY-MM-DD')`.as("d"),
        total: sql<string>`coalesce(sum(${payment.amount})::text, '0')`.as("t"),
      })
      .from(payment)
      .where(
        and(
          inArray(payment.status, ["captured", "authorized"]),
          gte(payment.createdAt, range.start),
          lte(payment.createdAt, range.end),
        ),
      )
      .groupBy(sql`date_trunc('day', ${payment.createdAt})`)
      .orderBy(sql`date_trunc('day', ${payment.createdAt})`);

    return rows.map((r) => ({ date: r.date, total: r.total }));
  }

  async getAverageOrderValue(range: DateRange): Promise<string | null> {
    const [row] = await this.db
      .select({ v: avg(payment.amount) })
      .from(payment)
      .where(
        and(
          inArray(payment.status, ["captured", "authorized"]),
          gte(payment.createdAt, range.start),
          lte(payment.createdAt, range.end),
        ),
      );
    if (row?.v == null) return null;
    return String(row.v);
  }
}
