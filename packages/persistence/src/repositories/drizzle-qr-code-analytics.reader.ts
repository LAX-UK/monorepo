import type { Database } from "@auction/db";
import { qrCodeScan, qrCodeScanDaily } from "@auction/db/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { IQrCodeAnalyticsReader } from "../interfaces/qr-code-analytics.reader.js";
import type {
  QrCodeAnalyticsRange,
  QrCodeDailyAggregates,
  QrCodeRawAggregates,
} from "../interfaces/qr-code-analytics.types.js";

const TOP_N = 5;

function utcDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Half-open daily upper bound: includes the UTC day containing `to`. */
function dailyUpperExclusiveDay(to: Date): Date {
  const upper = utcDayStart(to);
  upper.setUTCDate(upper.getUTCDate() + 1);
  return upper;
}

function dailyWhere(qrCodeId: string, from: Date | null, to: Date) {
  const clauses = [
    eq(qrCodeScanDaily.qrCodeId, qrCodeId),
    lt(qrCodeScanDaily.day, dailyUpperExclusiveDay(to)),
  ];
  if (from) clauses.push(gte(qrCodeScanDaily.day, from));
  return and(...clauses);
}

function rawWhere(qrCodeId: string, from: Date | null, to: Date) {
  const clauses = [eq(qrCodeScan.qrCodeId, qrCodeId), lt(qrCodeScan.scannedAt, to)];
  if (from) clauses.push(gte(qrCodeScan.scannedAt, from));
  return and(...clauses);
}

export class DrizzleQrCodeAnalyticsReader implements IQrCodeAnalyticsReader {
  constructor(private readonly db: Database) {}

  async fetchDailyAggregates(
    qrCodeId: string,
    range: QrCodeAnalyticsRange,
  ): Promise<QrCodeDailyAggregates> {
    const where = dailyWhere(qrCodeId, range.from, range.to);

    const [totalRow, trendRows, deviceRows, countryRows] = await Promise.all([
      this.db
        .select({ total: sql<number>`coalesce(sum(${qrCodeScanDaily.scans}), 0)::int` })
        .from(qrCodeScanDaily)
        .where(where),
      this.db
        .select({
          bucketAt: qrCodeScanDaily.day,
          scans: sql<number>`sum(${qrCodeScanDaily.scans})::int`,
        })
        .from(qrCodeScanDaily)
        .where(where)
        .groupBy(qrCodeScanDaily.day)
        .orderBy(qrCodeScanDaily.day),
      this.db
        .select({
          key: qrCodeScanDaily.deviceType,
          scans: sql<number>`sum(${qrCodeScanDaily.scans})::int`,
        })
        .from(qrCodeScanDaily)
        .where(where)
        .groupBy(qrCodeScanDaily.deviceType)
        .orderBy(desc(sql`sum(${qrCodeScanDaily.scans})`))
        .limit(TOP_N),
      this.db
        .select({
          key: qrCodeScanDaily.country,
          scans: sql<number>`sum(${qrCodeScanDaily.scans})::int`,
        })
        .from(qrCodeScanDaily)
        .where(where)
        .groupBy(qrCodeScanDaily.country)
        .orderBy(desc(sql`sum(${qrCodeScanDaily.scans})`))
        .limit(TOP_N),
    ]);

    return {
      total: totalRow[0]?.total ?? 0,
      trend: trendRows,
      device: deviceRows,
      country: countryRows,
    };
  }

  async fetchRawAggregates(
    qrCodeId: string,
    range: QrCodeAnalyticsRange,
  ): Promise<QrCodeRawAggregates> {
    const where = rawWhere(qrCodeId, range.from, range.to);
    const hourBucket = sql`date_trunc('hour', ${qrCodeScan.scannedAt} AT TIME ZONE 'UTC')`;

    const [
      totalRow,
      uniqueRow,
      trendRows,
      deviceRows,
      countryRows,
      browserRows,
      osRows,
      referrerRows,
      recentRows,
    ] = await Promise.all([
      this.db.select({ total: sql<number>`count(*)::int` }).from(qrCodeScan).where(where),
      this.db
        .select({ n: sql<number>`count(distinct ${qrCodeScan.ipPrefix})::int` })
        .from(qrCodeScan)
        .where(and(where, sql`${qrCodeScan.ipPrefix} is not null`)),
      this.db
        .select({
          bucketAt: sql<Date>`${hourBucket}`,
          scans: sql<number>`count(*)::int`,
        })
        .from(qrCodeScan)
        .where(where)
        .groupBy(hourBucket)
        .orderBy(hourBucket),
      this.db
        .select({
          key: qrCodeScan.deviceType,
          scans: sql<number>`count(*)::int`,
        })
        .from(qrCodeScan)
        .where(where)
        .groupBy(qrCodeScan.deviceType)
        .orderBy(desc(sql`count(*)`))
        .limit(TOP_N),
      this.db
        .select({
          key: qrCodeScan.country,
          scans: sql<number>`count(*)::int`,
        })
        .from(qrCodeScan)
        .where(where)
        .groupBy(qrCodeScan.country)
        .orderBy(desc(sql`count(*)`))
        .limit(TOP_N),
      this.db
        .select({
          key: qrCodeScan.browser,
          scans: sql<number>`count(*)::int`,
        })
        .from(qrCodeScan)
        .where(where)
        .groupBy(qrCodeScan.browser)
        .orderBy(desc(sql`count(*)`))
        .limit(TOP_N),
      this.db
        .select({
          key: qrCodeScan.os,
          scans: sql<number>`count(*)::int`,
        })
        .from(qrCodeScan)
        .where(where)
        .groupBy(qrCodeScan.os)
        .orderBy(desc(sql`count(*)`))
        .limit(TOP_N),
      this.db
        .select({
          key: qrCodeScan.referrerHost,
          scans: sql<number>`count(*)::int`,
        })
        .from(qrCodeScan)
        .where(where)
        .groupBy(qrCodeScan.referrerHost)
        .orderBy(desc(sql`count(*)`))
        .limit(TOP_N),
      this.db
        .select({
          scannedAt: qrCodeScan.scannedAt,
          deviceType: qrCodeScan.deviceType,
          browser: qrCodeScan.browser,
          os: qrCodeScan.os,
          country: qrCodeScan.country,
          referrerHost: qrCodeScan.referrerHost,
        })
        .from(qrCodeScan)
        .where(where)
        .orderBy(desc(qrCodeScan.scannedAt))
        .limit(20),
    ]);

    return {
      total: totalRow[0]?.total ?? 0,
      uniqueIps: uniqueRow[0]?.n ?? 0,
      trend: trendRows,
      device: deviceRows,
      country: countryRows,
      browser: browserRows,
      os: osRows,
      referrer: referrerRows,
      recent: recentRows,
    };
  }
}
