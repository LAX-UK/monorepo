import { describe, expect, it, vi } from "vitest";
import { QrCodeAnalyticsService } from "./qr-code-analytics.service.js";

function mockDailyDb(rows: {
  total?: number;
  trend?: { bucketAt: Date; scans: number }[];
  device?: { key: string; scans: number }[];
  country?: { key: string; scans: number }[];
}) {
  const total = rows.total ?? 0;
  const trend = rows.trend ?? [];
  const device = rows.device ?? [];
  const country = rows.country ?? [];

  let call = 0;
  const select = vi.fn().mockImplementation(() => {
    call += 1;
    if (call === 1) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total }]),
        }),
      };
    }
    if (call === 2) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(trend),
            }),
          }),
        }),
      };
    }
    const breakdownRows = call === 3 ? device : country;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(breakdownRows),
            }),
          }),
        }),
      }),
    };
  });

  return { select } as never;
}

function mockRawDb(recentRows: Array<Record<string, unknown>>) {
  let call = 0;
  const emptyGrouped = {
    groupBy: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  };
  const select = vi.fn().mockImplementation(() => {
    call += 1;
    if (call === 1) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 1 }]),
        }),
      };
    }
    if (call === 2) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ n: 1 }]),
        }),
      };
    }
    if (call === 3) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
    }
    if (call === 9) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(recentRows),
            }),
          }),
        }),
      };
    }
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(emptyGrouped),
      }),
    };
  });

  return { select } as never;
}

describe("QrCodeAnalyticsService", () => {
  it("returns daily analytics without raw-only breakdowns", async () => {
    const service = new QrCodeAnalyticsService(
      mockDailyDb({
        total: 12,
        trend: [{ bucketAt: new Date("2026-06-12T00:00:00.000Z"), scans: 12 }],
        device: [{ key: "mobile", scans: 12 }],
        country: [{ key: "GB", scans: 12 }],
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
      mockRawDb([
        {
          scannedAt: new Date("2026-06-13T14:00:00.000Z"),
          deviceType: "mobile",
          browser: "safari",
          os: "ios",
          country: "GB",
          referrerHost: null,
        },
      ]),
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
