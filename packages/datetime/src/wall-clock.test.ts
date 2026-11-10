import { describe, expect, it } from "vitest";
import {
  firstExistingWallTime,
  instantToWallClock,
  reinterpretInZone,
  wallClockToInstant,
} from "./wall-clock.js";

type Row = [zone: string, day: string, time: string, iso: string];

/** `gap` marks a time the clocks skip. */
const ROWS: Row[] = [
  // London: forward 29 Mar 2026, back 25 Oct 2026.
  ["Europe/London", "2026-03-29", "00:59", "2026-03-29T00:59:00.000Z"],
  ["Europe/London", "2026-03-29", "01:30", "gap"],
  ["Europe/London", "2026-03-29", "02:00", "2026-03-29T01:00:00.000Z"],
  ["Europe/London", "2026-10-25", "01:30", "2026-10-25T00:30:00.000Z"],
  ["Europe/London", "2026-10-25", "02:00", "2026-10-25T02:00:00.000Z"],
  // New York: forward 8 Mar 2026 (02:00 to 03:00), back 1 Nov 2026.
  ["America/New_York", "2026-03-08", "01:59", "2026-03-08T06:59:00.000Z"],
  ["America/New_York", "2026-03-08", "02:30", "gap"],
  ["America/New_York", "2026-03-08", "03:00", "2026-03-08T07:00:00.000Z"],
  ["America/New_York", "2026-03-08", "04:00", "2026-03-08T08:00:00.000Z"],
  ["America/New_York", "2026-03-08", "06:30", "2026-03-08T10:30:00.000Z"],
  ["America/New_York", "2026-11-01", "01:30", "2026-11-01T05:30:00.000Z"],
  ["America/New_York", "2026-11-01", "02:00", "2026-11-01T07:00:00.000Z"],
  // Sydney: forward 4 Oct 2026 (02:00 to 03:00), back 4 Apr 2027 (03:00 to 02:00).
  ["Australia/Sydney", "2026-10-03", "12:00", "2026-10-03T02:00:00.000Z"],
  ["Australia/Sydney", "2026-10-04", "01:59", "2026-10-03T15:59:00.000Z"],
  ["Australia/Sydney", "2026-10-04", "02:30", "gap"],
  ["Australia/Sydney", "2026-10-04", "03:00", "2026-10-03T16:00:00.000Z"],
  ["Australia/Sydney", "2026-10-04", "12:00", "2026-10-04T01:00:00.000Z"],
  ["Australia/Sydney", "2027-04-04", "02:30", "2027-04-03T15:30:00.000Z"],
  ["Australia/Sydney", "2027-04-04", "03:00", "2027-04-03T17:00:00.000Z"],
  // Auckland: forward 27 Sep 2026 (02:00 to 03:00), back 4 Apr 2027 (03:00 to 02:00).
  ["Pacific/Auckland", "2026-09-26", "12:00", "2026-09-26T00:00:00.000Z"],
  ["Pacific/Auckland", "2026-09-27", "01:59", "2026-09-26T13:59:00.000Z"],
  ["Pacific/Auckland", "2026-09-27", "02:30", "gap"],
  ["Pacific/Auckland", "2026-09-27", "03:00", "2026-09-26T14:00:00.000Z"],
  ["Pacific/Auckland", "2026-09-27", "09:00", "2026-09-26T20:00:00.000Z"],
  ["Pacific/Auckland", "2027-04-04", "02:30", "2027-04-03T13:30:00.000Z"],
  // Lord Howe: a 30-minute shift, forward 4 Oct 2026 (02:00 to 02:30), back 4 Apr 2027.
  ["Australia/Lord_Howe", "2026-10-04", "01:59", "2026-10-03T15:29:00.000Z"],
  ["Australia/Lord_Howe", "2026-10-04", "02:15", "gap"],
  ["Australia/Lord_Howe", "2026-10-04", "02:30", "2026-10-03T15:30:00.000Z"],
  // No clock change, and half-hour zones.
  ["Asia/Dubai", "2026-03-29", "01:30", "2026-03-28T21:30:00.000Z"],
  ["Asia/Kolkata", "2026-11-12", "18:00", "2026-11-12T12:30:00.000Z"],
  ["Pacific/Chatham", "2026-11-12", "18:00", "2026-11-12T04:15:00.000Z"],
];

describe("wallClockToInstant", () => {
  it.each(ROWS)("%s %s %s", (zone, day, time, expected) => {
    const result = wallClockToInstant(day, time, zone);
    if (expected === "gap") {
      expect(result).toEqual({ ok: false, reason: "gap" });
      return;
    }
    expect(result.ok && result.instant.toISOString()).toBe(expected);
  });

  it("round-trips every time that exists", () => {
    for (const [zone, day, time, expected] of ROWS) {
      if (expected === "gap") continue;
      const result = wallClockToInstant(day, time, zone);
      if (result.ok && !(zone === "Australia/Sydney" && day === "2027-04-04")) {
        expect(instantToWallClock(result.instant, zone)).toEqual({ day, time });
      }
    }
  });

  it("takes the earlier instant in a repeated hour, in zones behind and ahead of UTC", () => {
    const ny = wallClockToInstant("2026-11-01", "01:30", "America/New_York");
    expect(ny.ok && ny.instant.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    const sydney = wallClockToInstant("2027-04-04", "02:30", "Australia/Sydney");
    expect(sydney.ok && sydney.instant.toISOString()).toBe("2027-04-03T15:30:00.000Z");
  });

  it("rejects text that is not a day and a time", () => {
    const bad = [
      ["", "10:00"],
      ["2026-02-30", "10:00"],
      ["2026-11-12", "24:00"],
      ["x", "y"],
    ] as const;
    for (const [day, time] of bad) {
      expect(wallClockToInstant(day, time, "Europe/London")).toEqual({
        ok: false,
        reason: "invalid",
      });
    }
  });
});

describe("reinterpretInZone", () => {
  it("keeps the wall-clock time and moves the instant", () => {
    const london = new Date("2030-11-12T18:00:00Z");
    expect(reinterpretInZone(london, "Europe/London", "America/New_York").toISOString()).toBe(
      "2030-11-12T23:00:00.000Z",
    );
    expect(reinterpretInZone(london, "Europe/London", "Asia/Dubai").toISOString()).toBe(
      "2030-11-12T14:00:00.000Z",
    );
  });

  it("moves a time the new zone skips to the hour after the change", () => {
    const instant = new Date("2026-03-08T02:30:00Z");
    expect(reinterpretInZone(instant, "UTC", "America/New_York").toISOString()).toBe(
      "2026-03-08T07:00:00.000Z",
    );
  });

  it("is the identity for the same zone", () => {
    const instant = new Date("2026-10-25T00:30:00Z");
    expect(reinterpretInZone(instant, "Europe/London", "Europe/London").toISOString()).toBe(
      instant.toISOString(),
    );
  });
});

describe("firstExistingWallTime", () => {
  it("is the same time on an ordinary day and the end of the skipped hour in a gap", () => {
    expect(firstExistingWallTime("2026-03-29", "12:00", "Europe/London")).toBe("12:00");
    expect(firstExistingWallTime("2026-03-29", "01:30", "Europe/London")).toBe("02:00");
    expect(firstExistingWallTime("2026-03-08", "02:10", "America/New_York")).toBe("03:00");
    expect(firstExistingWallTime("2026-10-04", "02:10", "Australia/Lord_Howe")).toBe("02:30");
  });
});
