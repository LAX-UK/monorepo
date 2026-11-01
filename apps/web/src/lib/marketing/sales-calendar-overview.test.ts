import { describe, expect, it } from "vitest";
import { calendarTabCounts } from "./sales-calendar-overview";
import { calendarSaleRow } from "./sales-calendar.fixtures";

describe("calendarTabCounts", () => {
  it("counts the rows of each section that loaded", () => {
    expect(
      calendarTabCounts({
        live: [],
        upcoming: [calendarSaleRow("a", "scheduled"), calendarSaleRow("b", "scheduled")],
      }),
    ).toEqual({ live: 0, upcoming: 2 });
  });

  it("leaves a section that failed out of the counts", () => {
    expect(calendarTabCounts({ results: [calendarSaleRow("c", "ended")] })).toEqual({ results: 1 });
  });
});
