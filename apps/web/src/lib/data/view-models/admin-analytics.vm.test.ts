import { describe, expect, it } from "vitest";
import {
  compareCountSeriesHalves,
  compareSeriesHalves,
  formatPctChange,
  pctToDeltaTone,
  sparklineForCounts,
  winRatePercent,
} from "./admin-analytics.vm";

describe("admin-analytics.vm", () => {
  it("compareSeriesHalves splits revenue", () => {
    const series = [
      { date: "a", total: "10" },
      { date: "b", total: "10" },
      { date: "c", total: "20" },
      { date: "d", total: "20" },
    ];
    const r = compareSeriesHalves(series);
    expect(r.previous).toBe(20);
    expect(r.current).toBe(40);
    expect(r.pctChange).toBe(100);
  });

  it("compareCountSeriesHalves splits counts", () => {
    const series = [
      { date: "a", count: 1 },
      { date: "b", count: 1 },
      { date: "c", count: 3 },
      { date: "d", count: 3 },
    ];
    const r = compareCountSeriesHalves(series);
    expect(r.previous).toBe(2);
    expect(r.current).toBe(6);
    expect(r.pctChange).toBe(200);
  });

  it("formatPctChange handles null", () => {
    expect(formatPctChange(null)).toContain("prior half");
  });

  it("pctToDeltaTone", () => {
    expect(pctToDeltaTone(5)).toBe("positive");
    expect(pctToDeltaTone(-5)).toBe("negative");
    expect(pctToDeltaTone(0)).toBe("neutral");
  });

  it("sparklineForCounts derives from series", () => {
    const s = [
      { date: "1", count: 0 },
      { date: "2", count: 4 },
    ];
    expect(sparklineForCounts(undefined, s)).toEqual([0, 1]);
  });

  it("winRatePercent", () => {
    expect(winRatePercent(0, 0)).toBe("—");
    expect(winRatePercent(10, 3)).toBe("30%");
  });
});
