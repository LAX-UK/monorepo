import type { QrCodeDetailedAnalytics, ResolvedQrCodeAnalyticsQuery } from "@auction/validators";
import type { IQrCodeAnalyticsReader } from "../repositories/interfaces/qr-code-analytics.reader.js";
import {
  fillTrendGaps,
  foldTopN,
  formatDayBucket,
  formatHourBucket,
  normalizeBreakdownKey,
} from "./qr-code-analytics.helpers.js";

export type { QrCodeDetailedAnalytics };

const TOP_N = 5;

export class QrCodeAnalyticsService {
  constructor(private readonly reader: IQrCodeAnalyticsReader) {}

  async getDetailed(
    qrCodeId: string,
    query: ResolvedQrCodeAnalyticsQuery,
  ): Promise<QrCodeDetailedAnalytics> {
    if (query.source === "raw") {
      return this.getFromRaw(qrCodeId, query);
    }
    return this.getFromDaily(qrCodeId, query);
  }

  private async getFromDaily(
    qrCodeId: string,
    query: ResolvedQrCodeAnalyticsQuery,
  ): Promise<QrCodeDetailedAnalytics> {
    const {
      total,
      trend: trendRows,
      device: deviceRows,
      country: countryRows,
    } = await this.reader.fetchDailyAggregates(qrCodeId, {
      from: query.from,
      to: query.to,
    });

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
      totalScans: total,
      uniqueIps: null,
      trend,
      byDevice: foldTopN(
        deviceRows.map((row) => ({ key: normalizeBreakdownKey(row.key), scans: row.scans })),
        total,
        TOP_N,
      ),
      byCountry: foldTopN(
        countryRows.map((row) => ({ key: normalizeBreakdownKey(row.key), scans: row.scans })),
        total,
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
  ): Promise<QrCodeDetailedAnalytics> {
    const {
      total,
      uniqueIps,
      trend: trendRows,
      device: deviceRows,
      country: countryRows,
      browser: browserRows,
      os: osRows,
      referrer: referrerRows,
      recent: recentRows,
    } = await this.reader.fetchRawAggregates(qrCodeId, {
      from: query.from,
      to: query.to,
    });

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
      totalScans: total,
      uniqueIps,
      trend,
      byDevice: foldTopN(mapRows(deviceRows), total, TOP_N),
      byCountry: foldTopN(mapRows(countryRows), total, TOP_N),
      byBrowser: foldTopN(mapRows(browserRows), total, TOP_N),
      byOs: foldTopN(mapRows(osRows), total, TOP_N),
      byReferrer: foldTopN(
        mapRows(referrerRows).map((row) => ({
          key: row.key === "unknown" ? "direct" : row.key,
          scans: row.scans,
        })),
        total,
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
