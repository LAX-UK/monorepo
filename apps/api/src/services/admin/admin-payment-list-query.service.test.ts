import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPaymentListQueryService } from "./admin-payment-list-query.service.js";

function repo(volumeByDay: Map<string, number>) {
  return {
    listForAdminTable: vi.fn().mockResolvedValue([]),
    countForAdminTable: vi.fn().mockResolvedValue(0),
    summarizeForAdminTable: vi
      .fn()
      .mockResolvedValue({ totalVolume: "10", captured: "0", pending: "0", refunded: "0" }),
    sumAdminTableVolumeByDay: vi.fn().mockResolvedValue(volumeByDay),
  };
}

describe("AdminPaymentListQueryService", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_KPI_TREND_ANCHOR", "2026-10-26T12:00:00.000Z");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("adds the matching payments' daily volume for 30 days and the 30 days before", async () => {
    const payments = repo(
      new Map([
        ["2026-10-26", 5000],
        ["2026-09-27", 1200],
        ["2026-09-26", 700],
        ["2026-08-28", 300],
      ]),
    );
    const service = new AdminPaymentListQueryService(
      payments as unknown as IPaymentWriteRepository,
    );

    const page = await service.getPage({ limit: 50, offset: 0, status: "captured", q: "harbour" });

    const filter = { status: "captured", q: "harbour" };
    expect(payments.summarizeForAdminTable).toHaveBeenCalledWith(filter);
    expect(payments.sumAdminTableVolumeByDay).toHaveBeenCalledWith(
      filter,
      new Date("2026-08-28T00:00:00.000Z"),
    );
    const trend = page.summary.volumeTrend;
    expect(trend.periodDays).toBe(30);
    expect(trend.dailyPence).toHaveLength(30);
    expect(trend.dailyPence[0]).toBe(1200);
    expect(trend.dailyPence[29]).toBe(5000);
    expect(trend.currentPence).toBe(6200);
    expect(trend.priorPence).toBe(1000);
    expect(page.summary.totalVolume).toBe("10");
  });
});
