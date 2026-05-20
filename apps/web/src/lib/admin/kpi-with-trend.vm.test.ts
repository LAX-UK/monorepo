import { describe, expect, it } from "vitest";
import { buildKpiWithTrend } from "./kpi-with-trend.vm";

describe("buildKpiWithTrend", () => {
  it("computes positive delta when current exceeds prior", () => {
    const kpi = buildKpiWithTrend({
      label: "Clients",
      current: 120,
      prior: 100,
      dailySeries: [1, 2, 3, 4],
      period: "30d",
    });
    expect(kpi.delta.direction).toBe("up");
    expect(kpi.delta.tone).toBe("positive");
    expect(kpi.delta.value).toContain("%");
  });

  it("computes negative delta when current is below prior", () => {
    const kpi = buildKpiWithTrend({
      label: "Lots",
      current: 40,
      prior: 80,
      dailySeries: [4, 3, 2, 1],
      period: "7d",
    });
    expect(kpi.delta.direction).toBe("down");
    expect(kpi.delta.tone).toBe("negative");
  });

  it("handles division by zero when prior is 0 and current > 0", () => {
    const kpi = buildKpiWithTrend({
      label: "New",
      current: 5,
      prior: 0,
      dailySeries: [0, 1, 2],
      period: "7d",
    });
    expect(kpi.delta.direction).toBe("up");
    expect(kpi.delta.value).toBe("100%");
  });

  it("returns flat delta when change is negligible", () => {
    const kpi = buildKpiWithTrend({
      label: "Flat",
      current: 100,
      prior: 100,
      dailySeries: [1, 1, 1],
      period: "90d",
    });
    expect(kpi.delta.direction).toBe("flat");
    expect(kpi.delta.tone).toBe("neutral");
  });
});
