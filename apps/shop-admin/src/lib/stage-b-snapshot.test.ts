import { createdPresetRange } from "@/server/domain/order-list.vm";
import { describe, expect, it } from "vitest";
import { formatCalendarDay, formatDateRange, formatLondonTime } from "./editorial-time";
import golden from "./stage-b-snapshot.golden.json";

/**
 * Stage B moves the shop admin's date code onto `@auction/datetime` with no visible change. The
 * golden strings were recorded from the code before the move; this test renders the same paths
 * afterwards and must pass unchanged.
 */
const INSTANTS = [
  "2026-01-01T00:00:00Z",
  "2025-12-31T23:59:00Z",
  "2026-01-15T09:05:00Z",
  "2026-03-28T23:30:00Z",
  "2026-03-29T00:30:00Z",
  "2026-03-29T01:00:00Z",
  "2026-03-29T01:30:00Z",
  "2026-03-31T23:30:00Z",
  "2026-06-18T14:30:00Z",
  "2026-09-29T10:05:00Z",
  "2026-10-24T23:30:00Z",
  "2026-10-25T00:30:00Z",
  "2026-10-25T01:30:00Z",
  "2026-10-31T23:30:00Z",
  "2026-11-03T21:00:00Z",
  "2026-11-12T04:49:00Z",
  "2026-12-31T23:59:00Z",
  "2027-01-01T00:00:00Z",
] as const;

function renderSweep(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const iso of INSTANTS) {
    const day = iso.slice(0, 10);
    out[`londonTime ${iso}`] = formatLondonTime(iso);
    out[`calendarDay ${iso}`] = formatCalendarDay(day);
    out[`dateRange ${iso}`] = String(formatDateRange(day, "2027-02-03"));
    out[`dateRangeFrom ${iso}`] = String(formatDateRange(day, null));
    out[`dateRangeUntil ${iso}`] = String(formatDateRange(null, day));
    for (const id of ["today", "7d", "30d", "90d"] as const) {
      out[`createdPreset ${id} ${iso}`] = JSON.stringify(createdPresetRange(id, new Date(iso)));
    }
  }
  out.londonTimeBad = formatLondonTime("not-a-date");
  out.calendarDayBad = formatCalendarDay("not-a-date");
  return out;
}

describe("Stage B snapshot sweep (shop admin)", () => {
  const actual = renderSweep();
  const expected = golden as Record<string, string>;

  it("renders the same number of cases as were recorded", () => {
    expect(Object.keys(actual).length).toBe(Object.keys(expected).length);
    expect(Object.keys(actual).length).toBeGreaterThan(150);
  });

  it("renders every date and time string byte-for-byte as recorded", () => {
    const changed = Object.keys(expected).filter((key) => actual[key] !== expected[key]);
    expect(changed.map((k) => `${k}: ${actual[k]} != ${expected[k]}`)).toEqual([]);
  });
});
