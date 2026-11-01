import { describe, expect, it } from "vitest";
import {
  addWorkingMinutes,
  LONDON_WORKING_CALENDAR as calendar,
  englandAndWalesBankHolidays,
  londonWorkingCalendar,
  workingMinutesBetween,
} from "./working-hours.js";

const at = (iso: string) => new Date(iso);

describe("englandAndWalesBankHolidays", () => {
  it("lists the 2026 holidays, with Boxing Day moved off the Saturday", () => {
    expect(englandAndWalesBankHolidays(2026)).toEqual([
      "2026-01-01",
      "2026-04-03",
      "2026-04-06",
      "2026-05-04",
      "2026-05-25",
      "2026-08-31",
      "2026-12-25",
      "2026-12-28",
    ]);
  });

  it("moves Christmas and Boxing Day when Christmas is on a Saturday", () => {
    expect(englandAndWalesBankHolidays(2027)).toContain("2027-12-27");
    expect(englandAndWalesBankHolidays(2027)).toContain("2027-12-28");
    expect(englandAndWalesBankHolidays(2027)).not.toContain("2027-12-25");
  });

  it("moves New Year's Day off a Sunday", () => {
    expect(englandAndWalesBankHolidays(2023)).toContain("2023-01-02");
  });
});

describe("workingMinutesBetween", () => {
  it("counts only the open hours of one day", () => {
    // Monday 2 November 2026, GMT.
    expect(
      workingMinutesBetween(calendar, at("2026-11-02T08:00:00Z"), at("2026-11-02T10:30:00Z")),
    ).toBe(90);
  });

  it("skips the weekend: a Friday evening message has waited nothing by Monday at nine", () => {
    expect(
      workingMinutesBetween(calendar, at("2026-10-30T19:00:00Z"), at("2026-11-02T09:00:00Z")),
    ).toBe(0);
  });

  it("counts in London time across the clocks going back", () => {
    // Friday 23 October 2026 17:00 BST (16:00Z) to Monday 26 October 10:00 GMT.
    expect(
      workingMinutesBetween(calendar, at("2026-10-23T16:00:00Z"), at("2026-10-26T10:00:00Z")),
    ).toBe(120);
  });

  it("leaves bank holidays out", () => {
    // Thursday 24 December 2026 17:00 to Tuesday 29 December 10:00: Friday 25 and Monday 28
    // are off, so an hour on Thursday and an hour on Tuesday.
    expect(
      workingMinutesBetween(calendar, at("2026-12-24T17:00:00Z"), at("2026-12-29T10:00:00Z")),
    ).toBe(120);
  });

  it("takes one-off holidays", () => {
    const withExtra = londonWorkingCalendar(["2026-11-02"]);
    expect(
      workingMinutesBetween(withExtra, at("2026-11-02T09:00:00Z"), at("2026-11-02T18:00:00Z")),
    ).toBe(0);
  });

  it("is 0 when the end is not after the start", () => {
    expect(
      workingMinutesBetween(calendar, at("2026-11-02T12:00:00Z"), at("2026-11-02T11:00:00Z")),
    ).toBe(0);
  });
});

describe("addWorkingMinutes", () => {
  it("lands inside the same day when there is time left", () => {
    expect(addWorkingMinutes(calendar, at("2026-11-02T10:00:00Z"), 120).toISOString()).toBe(
      "2026-11-02T12:00:00.000Z",
    );
  });

  it("carries the rest over to the next working morning", () => {
    // Friday 16:00 plus 9 hours: 2 hours on Friday, 7 on Monday.
    expect(addWorkingMinutes(calendar, at("2026-10-30T16:00:00Z"), 540).toISOString()).toBe(
      "2026-11-02T16:00:00.000Z",
    );
  });

  it("starts the clock at opening for a message sent overnight", () => {
    expect(addWorkingMinutes(calendar, at("2026-11-03T02:00:00Z"), 60).toISOString()).toBe(
      "2026-11-03T10:00:00.000Z",
    );
  });

  it("uses summer time", () => {
    // Wednesday 1 July 2026, 09:00 BST is 08:00Z.
    expect(addWorkingMinutes(calendar, at("2026-07-01T06:00:00Z"), 0).toISOString()).toBe(
      "2026-07-01T08:00:00.000Z",
    );
  });
});
