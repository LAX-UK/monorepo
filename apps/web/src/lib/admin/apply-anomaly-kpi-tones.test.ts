import { describe, expect, it } from "vitest";
import { anomalyToneByKpiId } from "./apply-anomaly-kpi-tones";

describe("anomalyToneByKpiId", () => {
  it("maps stale payment anomalies to stale-payments KPI tone", () => {
    const tones = anomalyToneByKpiId([
      { id: "stale-payments", severity: "warning", message: "3 stale" },
    ]);
    expect(tones["stale-payments"]).toBe("warning");
  });

  it("ignores info-level anomalies", () => {
    const tones = anomalyToneByKpiId([
      { id: "awaiting-capture", severity: "info", message: "High volume" },
    ]);
    expect(tones).toEqual({});
  });
});
