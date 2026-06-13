import { describe, expect, it, vi } from "vitest";
import { AdminLotsKpiTrendService } from "./admin-lots-kpi-trend.service.js";

describe("AdminLotsKpiTrendService", () => {
  it("returns daily counts for the current window and prior total", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([
              { dayKey: "2026-06-10", n: 2 },
              { dayKey: "2026-06-11", n: 1 },
              { dayKey: "2026-06-12", n: 3 },
            ]),
          }),
        }),
      }),
    };

    const service = new AdminLotsKpiTrendService(db as never);
    const trend = await service.getTrend(7);

    expect(trend.currentTotal).toBeGreaterThanOrEqual(0);
    expect(trend.dailyCounts).toHaveLength(7);
    expect(trend.priorTotal).toBeGreaterThanOrEqual(0);
  });
});
