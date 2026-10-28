import type { Database } from "@auction/db";
import { lot, sale } from "@auction/db/schema";
import { and, asc, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type {
  ConsignmentReadScope,
  IUpcomingSaleWorksReader,
  UpcomingSaleWorksRow,
} from "../interfaces/index.js";
import {
  consignedLotsWhere,
  lotCurrencySql,
  lotEstimateSql,
} from "./organisation-dashboard.sql.js";

const OPEN_LOT_STATUSES = ["scheduled", "active"] as const;
const UPCOMING_SALE_STATUSES = ["scheduled", "active"] as const;

/** The organisation's works in sales that have not ended, grouped by sale and currency. */
export class DrizzleUpcomingSaleWorksReader implements IUpcomingSaleWorksReader {
  constructor(private readonly db: Database) {}

  async list(
    scope: ConsignmentReadScope,
    now: Date,
    limit: number,
  ): Promise<UpcomingSaleWorksRow[]> {
    const low = lotEstimateSql("low");
    const high = lotEstimateSql("high");
    const rows = await this.db
      .select({
        saleId: sale.id,
        title: sale.title,
        startsAt: sale.startTime,
        currency: lotCurrencySql,
        works: count(),
        estimatedWorks: sql<number>`count(*) filter (where ${low} is not null and ${high} is not null)`,
        estimateLow: sql<string>`coalesce(sum(${low}) filter (where ${high} is not null), 0)`,
        estimateHigh: sql<string>`coalesce(sum(${high}) filter (where ${low} is not null), 0)`,
      })
      .from(lot)
      .innerJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          consignedLotsWhere(scope),
          inArray(lot.status, [...OPEN_LOT_STATUSES]),
          inArray(sale.status, [...UPCOMING_SALE_STATUSES]),
          isNull(sale.deletedAt),
          gt(sale.endTime, now),
        ),
      )
      .groupBy(sale.id, sale.title, sale.startTime, lotCurrencySql)
      .orderBy(asc(sale.startTime), asc(sale.id))
      .limit(limit);
    return rows.map((row) => ({
      saleId: row.saleId,
      title: row.title,
      startsAt: row.startsAt,
      currency: row.currency,
      works: Number(row.works),
      estimatedWorks: Number(row.estimatedWorks),
      estimateLow: String(row.estimateLow),
      estimateHigh: String(row.estimateHigh),
    }));
  }
}
