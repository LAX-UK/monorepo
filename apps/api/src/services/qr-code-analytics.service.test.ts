import type { IQrCodeAnalyticsReader, QrCodeDailyAggregates, QrCodeRawAggregates } from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { QrCodeAnalyticsService } from "./qr-code-analytics.service.js";

function fakeReader(overrides: {
  daily?: Partial<QrCodeDailyAggregates>;
  raw?: Partial<QrCodeRawAggregates>;
}): IQrCodeAnalyticsReader {
  return {
    fetchDailyAggregates: async () => ({
      total: 0,
      trend: [],
      device: [],
      country: [],
      ...overrides.daily,
    }),
    fetchRawAggregates: async () => ({
      total: 0,
      uniqueIps: 0,
      trend: [],
      device: [],
      country: [],
      browser: [],
      os: [],
      referrer: [],
      recent: [],
      ...overrides.raw,
    }),
  };
}

describe("QrCodeAnalyticsService", () => {
  it("returns daily analytics without raw-only breakdowns", async () => {
    const service = new QrCodeAnalyticsService(
      fakeReader({
        daily: {
          total: 12,
          trend: [{ bucketAt: new Date("2026-06-12T00:00:00.000Z"), scans: 12 }],
          device: [{ key: "mobile", scans: 12 }],
          country: [{ key: "GB", scans: 12 }],
        },
      }),
    );

    const result = await service.getDetailed("22222222-2222-4222-8222-222222222222", {
      from: new Date("2026-06-07T00:00:00.000Z"),
      to: new Date("2026-06-13T15:00:00.000Z"),
      granularity: "day",
      source: "daily",
      rangeKey: "7d",
    });

    expect(result.source).toBe("daily");
    expect(result.totalScans).toBe(12);
    expect(result.byBrowser).toBeNull();
    expect(result.recentScans).toBeNull();
    expect(result.byDevice[0]?.key).toBe("mobile");
  });

  it("returns raw analytics with recent scan fields", async () => {
    const service = new QrCodeAnalyticsService(
      fakeReader({
        raw: {
          total: 1,
          uniqueIps: 1,
          recent: [
            {
              scannedAt: new Date("2026-06-13T14:00:00.000Z"),
              deviceType: "mobile",
              browser: "safari",
              os: "ios",
              country: "GB",
              referrerHost: null,
            },
          ],
        },
      }),
    );

    const result = await service.getDetailed("22222222-2222-4222-8222-222222222222", {
      from: new Date("2026-06-12T15:00:00.000Z"),
      to: new Date("2026-06-13T15:00:00.000Z"),
      granularity: "hour",
      source: "raw",
      rangeKey: "24h",
    });

    expect(result.source).toBe("raw");
    expect(result.byBrowser).not.toBeNull();
    expect(result.recentScans?.[0]?.country).toBe("GB");
  });
});
