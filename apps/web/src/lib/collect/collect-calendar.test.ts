import type { CollectionDayView } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  calendarCells,
  dayOfSlot,
  firstOpenDay,
  weekSummary,
  windowHeading,
} from "./collect-calendar";

const NOW = new Date("2026-11-09T10:00:00.000Z");

const day = (
  date: string,
  state: CollectionDayView["state"],
  openSlots = 0,
  slots: CollectionDayView["slots"] = [],
): CollectionDayView => ({ date, state, openSlots, slots });

const slot = (start: string) => ({ start, end: start, placesLeft: 2, state: "open" as const });

// 2026-11-12 is a Thursday.
const DAYS = [
  day("2026-11-12", "open", 7, [slot("2026-11-12T14:00:00.000Z")]),
  day("2026-11-13", "full"),
  day("2026-11-14", "closed"),
];

describe("calendarCells", () => {
  it("leaves a blank for each weekday before the first day", () => {
    expect(calendarCells(DAYS, NOW).blanks).toBe(3);
  });

  it("says each day's state in words and reads it out in full", () => {
    const { days } = calendarCells(DAYS, NOW);
    expect(days.map((d) => d.caption)).toEqual(["7 times", "Full", "Closed"]);
    expect(days[0]?.label).toContain("12 Nov");
    expect(days[0]?.label).toContain("7 times");
    expect(days.map((d) => d.selectable)).toEqual([true, false, false]);
  });

  it("has short captions for a phone, with the full words kept in the label", () => {
    const { days } = calendarCells(
      [
        day("2026-11-12", "open", 7),
        day("2026-11-13", "full"),
        day("2026-11-14", "closed"),
        day("2026-11-15", "sale_day"),
        day("2026-11-16", "too_soon"),
      ],
      NOW,
    );
    expect(days.map((d) => d.shortCaption)).toEqual(["7", "Full", "Shut", "Sale", "Soon"]);
    expect(days[2]?.label).toContain("Closed");
  });

  it("says 1 time, not 1 times", () => {
    expect(calendarCells([day("2026-11-16", "open", 1)], NOW).days[0]?.caption).toBe("1 time");
  });

  it("is empty for no days", () => {
    expect(calendarCells([], NOW)).toEqual({ blanks: 0, days: [] });
  });
});

describe("window helpers", () => {
  it("finds the first day with a time to book", () => {
    expect(firstOpenDay([day("2026-11-12", "full"), day("2026-11-13", "open", 2)])).toBe(
      "2026-11-13",
    );
    expect(firstOpenDay([day("2026-11-12", "full")])).toBeNull();
  });

  it("finds the day a time falls on", () => {
    expect(dayOfSlot(DAYS, "2026-11-12T14:00:00.000Z")).toBe("2026-11-12");
    expect(dayOfSlot(DAYS, "2030-01-01T00:00:00.000Z")).toBeNull();
  });

  it("heads a window across months and years", () => {
    expect(windowHeading(DAYS)).toBe("November 2026");
    expect(windowHeading([day("2026-11-30", "open"), day("2026-12-01", "open")])).toBe(
      "November – December 2026",
    );
    expect(windowHeading([day("2026-12-30", "open"), day("2027-01-04", "open")])).toBe(
      "December 2026 – January 2027",
    );
  });
});

describe("weekSummary", () => {
  it("counts the days with times in the first week", () => {
    // Thursday 12th to Sunday 15th: the first week has four days.
    expect(
      weekSummary([
        day("2026-11-12", "open", 3),
        day("2026-11-13", "full"),
        day("2026-11-14", "closed"),
        day("2026-11-15", "closed"),
        day("2026-11-16", "open", 3),
      ]),
    ).toBe("1 day has times this week.");
    expect(
      weekSummary([
        day("2026-11-09", "open", 3),
        day("2026-11-10", "open", 3),
        day("2026-11-11", "open", 2),
        day("2026-11-12", "open", 2),
        day("2026-11-13", "full"),
      ]),
    ).toBe("4 days have times this week.");
    expect(weekSummary([day("2026-11-12", "full")])).toBe("No days have times this week.");
    expect(weekSummary([])).toBe("");
  });
});
