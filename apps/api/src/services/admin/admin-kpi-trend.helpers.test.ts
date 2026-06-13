import { describe, expect, it } from "vitest";
import {
  buildDayKeys,
  buildTrendWindows,
  bundleFromDailyCounts,
} from "./admin-kpi-trend.helpers.js";

describe("admin-kpi-trend.helpers", () => {
  it("buildDayKeys returns consecutive UTC day strings", () => {
    const keys = buildDayKeys(3, new Date("2026-06-12T15:00:00.000Z"));
    expect(keys).toHaveLength(3);
    expect(keys[2]).toBe("2026-06-12");
  });

  it("buildTrendWindows splits current and prior periods", () => {
    const { currentKeys, priorKeys } = buildTrendWindows(7, new Date("2026-06-12T12:00:00.000Z"));
    expect(currentKeys).toHaveLength(7);
    expect(priorKeys).toHaveLength(7);
    expect(currentKeys[0]).not.toBe(priorKeys[0]);
  });

  it("bundleFromDailyCounts sums current and prior totals", () => {
    const counts = new Map([
      ["2026-06-10", 2],
      ["2026-06-11", 1],
      ["2026-06-12", 3],
    ]);
    const bundle = bundleFromDailyCounts(
      counts,
      ["2026-06-11", "2026-06-12"],
      ["2026-06-10", "2026-06-11"],
    );
    expect(bundle.currentTotal).toBe(4);
    expect(bundle.priorTotal).toBe(3);
    expect(bundle.dailyCounts).toEqual([1, 3]);
  });
});
