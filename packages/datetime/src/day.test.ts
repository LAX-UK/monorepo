import { describe, expect, it } from "vitest";
import { dayKey, dayOffset, endOfDay, startOfDay } from "./day.js";
import { offsetMinutes } from "./offset.js";

describe("offsetMinutes at the instant", () => {
  it.each([
    ["Europe/London", "2026-01-15T12:00:00Z", 0],
    ["Europe/London", "2026-07-15T12:00:00Z", 60],
    ["Asia/Kolkata", "2026-07-15T12:00:00Z", 330],
    ["Asia/Kathmandu", "2026-07-15T12:00:00Z", 345],
    ["Pacific/Chatham", "2026-01-15T12:00:00Z", 825],
    ["Pacific/Chatham", "2026-07-15T12:00:00Z", 765],
    ["Australia/Lord_Howe", "2026-01-15T12:00:00Z", 660],
    ["Australia/Lord_Howe", "2026-07-15T12:00:00Z", 630],
    ["Pacific/Kiritimati", "2026-07-15T12:00:00Z", 840],
    ["Pacific/Honolulu", "2026-07-15T12:00:00Z", -600],
    ["UTC", "2026-07-15T12:00:00Z", 0],
  ])("%s at %s is %d minutes", (zone, iso, minutes) => {
    expect(offsetMinutes(new Date(iso), zone)).toBe(minutes);
  });
});

describe("day keys and day offsets", () => {
  it("names the calendar day in the zone, not in UTC", () => {
    const instant = new Date("2026-11-12T23:30:00Z");
    expect(dayKey(instant, "Europe/London")).toBe("2026-11-12");
    expect(dayKey(instant, "Australia/Sydney")).toBe("2026-11-13");
    expect(dayKey(instant, "Pacific/Honolulu")).toBe("2026-11-12");
  });

  it("counts whole days across a clock change", () => {
    const now = new Date("2026-03-28T12:00:00Z");
    expect(dayOffset(new Date("2026-03-29T12:00:00Z"), now, "Europe/London")).toBe(1);
    expect(dayOffset(new Date("2026-03-30T12:00:00Z"), now, "Europe/London")).toBe(2);
    expect(dayOffset(new Date("2026-03-27T23:30:00Z"), now, "Europe/London")).toBe(-1);
  });
});

describe("startOfDay and endOfDay in a zone", () => {
  it.each([
    [
      "a winter London day",
      "2026-11-12T18:00:00Z",
      "Europe/London",
      "2026-11-12T00:00:00.000Z",
      "2026-11-12T23:59:59.999Z",
    ],
    [
      "a summer London day",
      "2026-07-14T20:00:00Z",
      "Europe/London",
      "2026-07-13T23:00:00.000Z",
      "2026-07-14T22:59:59.999Z",
    ],
    [
      "the 23-hour day London springs forward",
      "2026-03-29T12:00:00Z",
      "Europe/London",
      "2026-03-29T00:00:00.000Z",
      "2026-03-29T22:59:59.999Z",
    ],
    [
      "the 25-hour day London falls back",
      "2026-10-25T12:00:00Z",
      "Europe/London",
      "2026-10-24T23:00:00.000Z",
      "2026-10-25T23:59:59.999Z",
    ],
    [
      "a Sydney day",
      "2026-11-12T18:00:00Z",
      "Australia/Sydney",
      "2026-11-12T13:00:00.000Z",
      "2026-11-13T12:59:59.999Z",
    ],
    [
      "a Kolkata day",
      "2026-11-12T18:00:00Z",
      "Asia/Kolkata",
      "2026-11-11T18:30:00.000Z",
      "2026-11-12T18:29:59.999Z",
    ],
  ])("%s", (_label, iso, zone, start, end) => {
    const instant = new Date(iso);
    expect(startOfDay(instant, zone).toISOString()).toBe(start);
    expect(endOfDay(instant, zone).toISOString()).toBe(end);
  });
});
