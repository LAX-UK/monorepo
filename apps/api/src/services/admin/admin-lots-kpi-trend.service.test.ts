import { describe, expect, it, vi } from "vitest";
import { AdminLotsKpiTrendService } from "./admin-lots-kpi-trend.service.js";

describe("AdminLotsKpiTrendService", () => {
  it("returns daily counts for the current window and prior total", async () => {
    const lotRepository = {
      countCreatedAtByDay: vi.fn().mockResolvedValue(
        new Map([
          ["2026-06-10", 2],
          ["2026-06-11", 1],
          ["2026-06-12", 3],
        ]),
      ),
    };

    const service = new AdminLotsKpiTrendService(lotRepository);
    const trend = await service.getTrend(7);

    expect(trend.currentTotal).toBeGreaterThanOrEqual(0);
    expect(trend.dailyCounts).toHaveLength(7);
    expect(trend.priorTotal).toBeGreaterThanOrEqual(0);
    expect(lotRepository.countCreatedAtByDay).toHaveBeenCalledOnce();
  });
});
