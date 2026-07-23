import { describe, expect, it } from "vitest";
import { applyKpiTrendOverlay } from "./apply-kpi-trend-overlay";

describe("applyKpiTrendOverlay", () => {
  it("returns trend and delta without a display value field", () => {
    const overlay = applyKpiTrendOverlay(
      {
        currentTotal: 10,
        priorTotal: 5,
        dailyCounts: [1, 2, 3, 4],
      },
      30,
    );
    expect(overlay.trend?.length).toBe(4);
    expect(overlay.deltaPercent).toBeTruthy();
    expect(overlay.compareHint).toContain("prior");
    expect(overlay).not.toHaveProperty("value");
  });
});
