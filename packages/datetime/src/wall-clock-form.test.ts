import { describe, expect, it } from "vitest";
import {
  defaultScheduleInstants,
  instantFromDatetimeFormString,
  resolveWallClock,
  toDatetimeFormString,
} from "./wall-clock-form.js";

const LONDON = "Europe/London";

describe("toDatetimeFormString", () => {
  it("reads the wall clock in the zone", () => {
    expect(toDatetimeFormString(new Date("2026-06-15T13:30:00Z"), LONDON)).toBe("2026-06-15T14:30");
    expect(toDatetimeFormString(new Date("2026-06-15T13:30:00Z"), "America/New_York")).toBe(
      "2026-06-15T09:30",
    );
  });

  it("reads the repeated hour when the clocks go back as the same wall time", () => {
    expect(toDatetimeFormString(new Date("2026-10-25T00:30:00Z"), LONDON)).toBe("2026-10-25T01:30");
    expect(toDatetimeFormString(new Date("2026-10-25T01:30:00Z"), LONDON)).toBe("2026-10-25T01:30");
  });
});

describe("instantFromDatetimeFormString", () => {
  it("reads summer and winter time", () => {
    expect(instantFromDatetimeFormString("2026-06-15T14:30", LONDON).toISOString()).toBe(
      "2026-06-15T13:30:00.000Z",
    );
    expect(instantFromDatetimeFormString("2026-12-15T14:30", LONDON).toISOString()).toBe(
      "2026-12-15T14:30:00.000Z",
    );
  });

  it("takes the first of the two repeated times when the clocks go back", () => {
    expect(instantFromDatetimeFormString("2026-10-25T01:30", LONDON).toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("moves a time the clocks skip on by the length of the gap", () => {
    expect(instantFromDatetimeFormString("2026-03-29T01:30", LONDON).toISOString()).toBe(
      "2026-03-29T01:30:00.000Z",
    );
    expect(
      toDatetimeFormString(instantFromDatetimeFormString("2026-03-29T01:30", LONDON), LONDON),
    ).toBe("2026-03-29T02:30");
  });

  it("defaults the time to midnight and rolls over the day's end", () => {
    expect(instantFromDatetimeFormString("2026-07-01", LONDON).toISOString()).toBe(
      "2026-06-30T23:00:00.000Z",
    );
    expect(instantFromDatetimeFormString("2026-02-30T10:00", LONDON).toISOString()).toBe(
      "2026-03-02T10:00:00.000Z",
    );
  });

  it("returns an invalid Date for nothing readable", () => {
    expect(Number.isNaN(instantFromDatetimeFormString("", LONDON).getTime())).toBe(true);
    expect(Number.isNaN(instantFromDatetimeFormString("soon", LONDON).getTime())).toBe(true);
  });
});

describe("resolveWallClock", () => {
  it("is null for a day that is not one", () => {
    expect(resolveWallClock("nope", "10:00", LONDON)).toBeNull();
  });
});

describe("defaultScheduleInstants", () => {
  it("starts at the top of the next hour and ends a week later at the same time", () => {
    const { start, end } = defaultScheduleInstants(new Date("2026-06-15T10:20:00Z"), LONDON);
    expect(toDatetimeFormString(start, LONDON)).toBe("2026-06-15T12:00");
    expect(toDatetimeFormString(end, LONDON)).toBe("2026-06-22T12:00");
  });

  it("rolls into the next day late in the evening", () => {
    const { start } = defaultScheduleInstants(new Date("2026-06-15T22:20:00Z"), LONDON);
    expect(toDatetimeFormString(start, LONDON)).toBe("2026-06-16T00:00");
  });

  it("keeps the wall-clock time across a clock change", () => {
    const { start, end } = defaultScheduleInstants(new Date("2026-10-20T09:10:00Z"), LONDON);
    expect(toDatetimeFormString(start, LONDON)).toBe("2026-10-20T11:00");
    expect(toDatetimeFormString(end, LONDON)).toBe("2026-10-27T11:00");
    expect(end.toISOString()).toBe("2026-10-27T11:00:00.000Z");
  });
});
