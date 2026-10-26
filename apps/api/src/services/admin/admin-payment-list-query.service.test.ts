import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPaymentListQueryService } from "./admin-payment-list-query.service.js";

const day = (
  volume: number,
  parts: Partial<Record<"captured" | "refunded" | "awaiting", number>>,
) => ({
  volume,
  captured: 0,
  refunded: 0,
  awaiting: 0,
  ...parts,
});

function repo(amountsByDay: Map<string, ReturnType<typeof day>>) {
  return {
    listForAdminTable: vi.fn().mockResolvedValue([]),
    countForAdminTable: vi.fn().mockResolvedValue(0),
    summarizeForAdminTable: vi
      .fn()
      .mockResolvedValue({ totalVolume: "10", captured: "0", pending: "0", refunded: "0" }),
    sumAdminTableAmountsByDay: vi.fn().mockResolvedValue(amountsByDay),
  };
}

describe("AdminPaymentListQueryService", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_KPI_TREND_ANCHOR", "2026-10-26T12:00:00.000Z");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lays each total's daily amounts over 30 days and the 30 days before", async () => {
    const payments = repo(
      new Map([
        ["2026-10-26", day(5000, { captured: 3000, awaiting: 2000 })],
        ["2026-09-27", day(1200, { refunded: 1200 })],
        ["2026-09-26", day(700, { captured: 700 })],
        ["2026-08-28", day(300, { awaiting: 300 })],
      ]),
    );
    const service = new AdminPaymentListQueryService(
      payments as unknown as IPaymentWriteRepository,
    );

    const page = await service.getPage({ limit: 50, offset: 0, status: "captured", q: "harbour" });

    const filter = { status: "captured", q: "harbour" };
    expect(payments.summarizeForAdminTable).toHaveBeenCalledWith(filter);
    expect(payments.sumAdminTableAmountsByDay).toHaveBeenCalledWith(
      filter,
      new Date("2026-08-28T00:00:00.000Z"),
    );
    const { trends } = page.summary;
    expect(trends.periodDays).toBe(30);
    expect(trends.volume.dailyPence).toHaveLength(30);
    expect(trends.volume.dailyPence[0]).toBe(1200);
    expect(trends.volume.dailyPence[29]).toBe(5000);
    expect(trends.volume).toMatchObject({ currentPence: 6200, priorPence: 1000 });
    expect(trends.captured).toMatchObject({ currentPence: 3000, priorPence: 700 });
    expect(trends.refunded).toMatchObject({ currentPence: 1200, priorPence: 0 });
    expect(trends.awaiting).toMatchObject({ currentPence: 2000, priorPence: 300 });
    expect(page.summary.totalVolume).toBe("10");
  });
});
