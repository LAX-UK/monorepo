import { describe, expect, it } from "vitest";
import { summariseWeeklyHours } from "./collection-hours-summary.js";
import { DEFAULT_COLLECTION_WEEKLY_HOURS } from "./collection-rules.js";

const day = (weekday: number, opensLocal: string, closesLocal: string) => ({
  weekday,
  opensLocal,
  closesLocal,
});

describe("summariseWeeklyHours", () => {
  it("reads the gallery's week as Monday to Friday", () => {
    expect(summariseWeeklyHours(DEFAULT_COLLECTION_WEEKLY_HOURS)).toBe(
      "Monday to Friday, 10:00 to 19:00",
    );
  });

  it("says nothing for a place that is never open", () => {
    expect(summariseWeeklyHours([])).toBeNull();
  });

  it("names a single day, and two days with 'and'", () => {
    expect(summariseWeeklyHours([day(3, "10:00", "13:00")])).toBe("Wednesday, 10:00 to 13:00");
    expect(summariseWeeklyHours([day(6, "10:00", "14:00"), day(7, "10:00", "14:00")])).toBe(
      "Saturday and Sunday, 10:00 to 14:00",
    );
  });

  it("joins runs of days with the same hours", () => {
    expect(
      summariseWeeklyHours([1, 2, 3, 5].map((weekday) => day(weekday, "09:00", "17:00"))),
    ).toBe("Monday to Wednesday and Friday, 09:00 to 17:00");
  });

  it("lists days with different hours separately", () => {
    expect(
      summariseWeeklyHours([
        ...[1, 2, 3, 4].map((weekday) => day(weekday, "10:00", "19:00")),
        day(5, "10:00", "17:00"),
      ]),
    ).toBe("Monday to Thursday, 10:00 to 19:00; Friday, 10:00 to 17:00");
  });

  it("shows a split day as two ranges, in order", () => {
    expect(
      summariseWeeklyHours([
        day(2, "14:00", "19:00"),
        day(2, "10:00", "13:00"),
        day(3, "10:00", "13:00"),
        day(3, "14:00", "19:00"),
      ]),
    ).toBe("Tuesday and Wednesday, 10:00 to 13:00 and 14:00 to 19:00");
  });
});
