import type { CollectionDayView } from "@auction/types";
import { describe, expect, it } from "vitest";
import { calendarCells, dayOfSlot, firstOpenDay, windowHeading } from "./collect-calendar";

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
