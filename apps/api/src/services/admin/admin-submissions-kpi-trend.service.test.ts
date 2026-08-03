import { describe, expect, it, vi } from "vitest";
import { AdminSubmissionsKpiTrendService } from "./admin-submissions-kpi-trend.service.js";

describe("AdminSubmissionsKpiTrendService", () => {
  it("delegates daily counts to the submission repository", async () => {
    const submissionRepository = {
      countCreatedAtByDay: vi.fn().mockResolvedValue(
        new Map([
          ["2026-07-20", 2],
          ["2026-07-21", 1],
        ]),
      ),
    };
    const service = new AdminSubmissionsKpiTrendService(submissionRepository);
    const trend = await service.getTrend(7);

    expect(submissionRepository.countCreatedAtByDay).toHaveBeenCalledOnce();
    expect(trend.currentTotal).toBeGreaterThanOrEqual(0);
    expect(trend.dailyCounts).toHaveLength(7);
  });
});
