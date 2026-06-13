import { type Database, qrCodeScan, qrCodeScanDaily } from "@auction/db";
import type { ResolvedQrCodeAnalyticsQuery } from "@auction/validators";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  type QrAnalyticsBreakdownRow,
  dailyUpperExclusiveDay,
  fillTrendGaps,
  foldTopN,
  formatDayBucket,
  formatHourBucket,
  normalizeBreakdownKey,
} from "./qr-code-analytics.helpers.js";

export type QrCodeRecentScanDto = {
  scannedAt: string;
  deviceType: string;
  browser: string;
  os: string;
  country: string;
  referrerHost: string | null;
};

export type QrCodeDetailedAnalyticsDto = {
  source: "raw" | "daily";
  granularity: "hour" | "day";
  rangeKey: string;
  totalScans: number;
  uniqueIps: number | null;
  trend: { bucket: string; scans: number }[];
  byDevice: QrAnalyticsBreakdownRow[];
  byCountry: QrAnalyticsBreakdownRow[];
  byBrowser: QrAnalyticsBreakdownRow[] | null;
  byOs: QrAnalyticsBreakdownRow[] | null;
  byReferrer: QrAnalyticsBreakdownRow[] | null;
  recentScans: QrCodeRecentScanDto[] | null;
};

const TOP_N = 5;

export class QrCodeAnalyticsService {
  constructor(private readonly db: Database) {}

  async getDetailed(
    qrCodeId: string,
    query: ResolvedQrCodeAnalyticsQuery,
  ): Promise<QrCodeDetailedAnalyticsDto> {
    if (query.source === "raw") {
      return this.getFromRaw(qrCodeId, query);
    }
    return this.getFromDaily(qrCodeId, query);
  }

  private dailyWhere(qrCodeId: string, from: Date | null, to: Date) {
    const clauses = [
      eq(qrCodeScanDaily.qrCodeId, qrCodeId),
      lt(qrCodeScanDaily.day, dailyUpperExclusiveDay(to)),
    ];
    if (from) clauses.push(gte(qrCodeScanDaily.day, from));
    return and(...clauses);
  }

  private rawWhere(qrCodeId: string, from: Date | null, to: Date) {
    const clauses = [eq(qrCodeScan.qrCodeId, qrCodeId), lt(qrCodeScan.scannedAt, to)];
    if (from) clauses.push(gte(qrCodeScan.scannedAt, from));
    return and(...clauses);
  }

  private async getFromDaily(
    qrCodeId: string,
    query: ResolvedQrCodeAnalyticsQuery,
  ): Promise<QrCodeDetailedAnalyticsDto> {
    const where = this.dailyWhere(qrCodeId, query.from, query.to);

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

    const totalScans = totalRow[0]?.total ?? 0;
    const trend = fillTrendGaps(
      trendRows.map((row) => ({
        bucket: formatDayBucket(row.bucketAt),
        scans: row.scans,
      })),
      query.from,
      query.to,
      "day",
    );

    return {
      source: "daily",
      granularity: "day",
      rangeKey: query.rangeKey,
      totalScans,
      uniqueIps: null,
      trend,
      byDevice: foldTopN(
        deviceRows.map((row) => ({ key: normalizeBreakdownKey(row.key), scans: row.scans })),
        totalScans,
        TOP_N,
      ),
      byCountry: foldTopN(
        countryRows.map((row) => ({ key: normalizeBreakdownKey(row.key), scans: row.scans })),
        totalScans,
        TOP_N,
      ),
      byBrowser: null,
      byOs: null,
      byReferrer: null,
      recentScans: null,
    };
  }

  private async getFromRaw(
    qrCodeId: string,
    query: ResolvedQrCodeAnalyticsQuery,
  ): Promise<QrCodeDetailedAnalyticsDto> {
    const where = this.rawWhere(qrCodeId, query.from, query.to);
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

    const totalScans = totalRow[0]?.total ?? 0;
    const trend = fillTrendGaps(
      trendRows.map((row) => ({
        bucket: formatHourBucket(row.bucketAt),
        scans: row.scans,
      })),
      query.from,
      query.to,
      "hour",
    );

    const mapRows = (rows: { key: string | null; scans: number }[]) =>
      rows.map((row) => ({ key: normalizeBreakdownKey(row.key), scans: row.scans }));

    return {
      source: "raw",
      granularity: "hour",
      rangeKey: query.rangeKey,
      totalScans,
      uniqueIps: uniqueRow[0]?.n ?? 0,
      trend,
      byDevice: foldTopN(mapRows(deviceRows), totalScans, TOP_N),
      byCountry: foldTopN(mapRows(countryRows), totalScans, TOP_N),
      byBrowser: foldTopN(mapRows(browserRows), totalScans, TOP_N),
      byOs: foldTopN(mapRows(osRows), totalScans, TOP_N),
      byReferrer: foldTopN(
        mapRows(referrerRows).map((row) => ({
          key: row.key === "unknown" ? "direct" : row.key,
          scans: row.scans,
        })),
        totalScans,
        TOP_N,
      ),
      recentScans: recentRows.map((row) => ({
        scannedAt: row.scannedAt.toISOString(),
        deviceType: normalizeBreakdownKey(row.deviceType),
        browser: normalizeBreakdownKey(row.browser),
        os: normalizeBreakdownKey(row.os),
        country: normalizeBreakdownKey(row.country),
        referrerHost: row.referrerHost,
      })),
    };
  }
}
