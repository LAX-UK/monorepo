import { describe, expect, it, vi } from "vitest";
import { AdminLotsHammerKpiTrendService } from "./admin-lots-hammer-kpi-trend.service.js";

describe("AdminLotsHammerKpiTrendService", () => {
  it("delegates to sumEndedHammerByDay for trend windows", async () => {
    const lotRepository = {
      sumEndedHammerByDay: vi.fn().mockResolvedValue(
        new Map([
          ["2026-07-14", 1200],
          ["2026-07-15", 800],
        ]),
      ),
    };
    const service = new AdminLotsHammerKpiTrendService(lotRepository);

    const trend = await service.getTrend(7);

    expect(lotRepository.sumEndedHammerByDay).toHaveBeenCalledOnce();
    expect(trend.dailyCounts).toHaveLength(7);
    expect(trend.currentTotal).toBeGreaterThanOrEqual(0);
  });
});
