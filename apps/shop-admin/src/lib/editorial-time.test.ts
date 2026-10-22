import { describe, expect, it } from "vitest";
import { formatCalendarDay, formatDateRange, formatLondonTime } from "./editorial-time";

describe("formatLondonTime", () => {
  it("reads in London time, summer and winter", () => {
    expect(formatLondonTime("2026-07-01T13:32:00.000Z")).toBe("14:32");
    expect(formatLondonTime("2026-01-01T13:32:00.000Z")).toBe("13:32");
  });

  it("returns the input when it is not a date", () => {
    expect(formatLondonTime("nonsense")).toBe("nonsense");
  });
});

describe("calendar days", () => {
  it("does not shift a date across a day boundary", () => {
    expect(formatCalendarDay("2026-06-01")).toBe("1 Jun 2026");
    expect(formatCalendarDay("2026-06-01T00:00:00.000Z")).toBe("1 Jun 2026");
  });

  it("describes ranges with one or both ends", () => {
    expect(formatDateRange("2026-06-01", "2026-06-30")).toBe("1 Jun 2026 – 30 Jun 2026");
    expect(formatDateRange("2026-06-01", null)).toBe("From 1 Jun 2026");
    expect(formatDateRange(null, "2026-06-30")).toBe("Until 30 Jun 2026");
    expect(formatDateRange(null, null)).toBeNull();
  });
});
