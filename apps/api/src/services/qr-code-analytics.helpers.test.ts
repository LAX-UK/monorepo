import { describe, expect, it } from "vitest";
import {
  dailyUpperExclusiveDay,
  fillTrendGaps,
  foldTopN,
  formatDayBucket,
  formatHourBucket,
  normalizeBreakdownKey,
} from "./qr-code-analytics.helpers.js";

describe("qr-code-analytics.helpers", () => {
  it("folds top N rows and adds other bucket", () => {
    const rows = [
      { key: "mobile", scans: 40 },
      { key: "desktop", scans: 30 },
      { key: "tablet", scans: 20 },
      { key: "bot", scans: 10 },
    ];
    expect(foldTopN(rows, 100, 2)).toEqual([
      { key: "mobile", scans: 40 },
      { key: "desktop", scans: 30 },
      { key: "other", scans: 30 },
    ]);
  });

  it("fills missing daily buckets", () => {
    const from = new Date("2026-06-11T00:00:00.000Z");
    const to = new Date("2026-06-13T12:00:00.000Z");
    const filled = fillTrendGaps([{ bucket: "2026-06-12", scans: 5 }], from, to, "day");
    expect(filled).toEqual([
      { bucket: "2026-06-11", scans: 0 },
      { bucket: "2026-06-12", scans: 5 },
      { bucket: "2026-06-13", scans: 0 },
    ]);
  });

  it("fills missing hourly buckets", () => {
    const from = new Date("2026-06-13T10:00:00.000Z");
    const to = new Date("2026-06-13T12:00:00.000Z");
    const filled = fillTrendGaps(
      [{ bucket: formatHourBucket(new Date("2026-06-13T11:00:00.000Z")), scans: 2 }],
      from,
      to,
      "hour",
    );
    expect(filled).toHaveLength(2);
    expect(filled[0]?.scans).toBe(0);
    expect(filled[1]?.scans).toBe(2);
  });

  it("formats bucket keys and normalizes breakdown labels", () => {
    expect(formatDayBucket(new Date("2026-06-13T15:30:00.000Z"))).toBe("2026-06-13");
    expect(formatHourBucket(new Date("2026-06-13T15:30:00.000Z"))).toBe("2026-06-13T15:00:00.000Z");
    expect(normalizeBreakdownKey(null)).toBe("unknown");
    expect(normalizeBreakdownKey("  mobile ")).toBe("mobile");
  });

  it("builds a half-open daily upper bound that includes the day of to", () => {
    expect(dailyUpperExclusiveDay(new Date("2026-06-13T15:30:00.000Z")).toISOString()).toBe(
      "2026-06-14T00:00:00.000Z",
    );
  });
});
