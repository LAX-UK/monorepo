import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, count, gte, lte, sql } from "drizzle-orm";
import type {
  DateRange,
  IUserMetricsReader,
  UserMetricPoint,
} from "../interfaces/metrics.reader.js";

export class DrizzleUserMetricsReader implements IUserMetricsReader {
  constructor(private readonly db: Database) {}

  async getRegistrationsByDate(range: DateRange): Promise<UserMetricPoint[]> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${user.createdAt}), 'YYYY-MM-DD')`.as("d"),
        count: sql<number>`count(*)::int`.as("c"),
      })
      .from(user)
      .where(and(gte(user.createdAt, range.start), lte(user.createdAt, range.end)))
      .groupBy(sql`date_trunc('day', ${user.createdAt})`)
      .orderBy(sql`date_trunc('day', ${user.createdAt})`);

    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  async getActiveUserCount(): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(user);
    return Number(row?.n ?? 0);
  }
}
