import { describe, expect, it } from "vitest";
import { clockChange, clockChangeNotice } from "./clock-change.js";

describe("clockChange", () => {
  it.each([
    ["2030-03-31", "Europe/London", "forward"],
    ["2030-10-27", "Europe/London", "back"],
    ["2030-03-10", "America/New_York", "forward"],
    ["2030-11-03", "America/New_York", "back"],
    ["2030-10-06", "Australia/Sydney", "forward"],
    ["2030-04-07", "Australia/Sydney", "back"],
    ["2030-03-10", "Europe/London", null],
    ["2030-06-01", "Asia/Dubai", null],
  ] as const)("%s in %s is %s", (day, zone, expected) => {
    expect(clockChange(day, zone)).toBe(expected);
  });
});

describe("clockChangeNotice", () => {
  it("names the skipped hour when London's clocks go forward", () => {
    expect(clockChangeNotice("2026-03-29", "Europe/London")).toBe(
      "Clocks go forward an hour on this day (GMT to BST): there is no 01:00 to 01:59.",
    );
  });

  it("names the repeated hour when London's clocks go back", () => {
    expect(clockChangeNotice("2026-10-25", "Europe/London")).toBe(
      "Clocks go back an hour on this day (BST to GMT): 01:00 to 01:59 happens twice; the first is used.",
    );
  });

  it("is silent on an ordinary day", () => {
    expect(clockChangeNotice("2026-10-24", "Europe/London")).toBeNull();
    expect(clockChangeNotice("2026-06-01", "Asia/Dubai")).toBeNull();
  });

  it("follows the sale's own zone, not London's", () => {
    // Paris changes at 02:00 local, on the same Sunday as London.
    expect(clockChangeNotice("2026-03-29", "Europe/Paris")).toBe(
      "Clocks go forward an hour on this day (CET to CEST): there is no 02:00 to 02:59.",
    );
    // New York changed three weeks earlier.
    expect(clockChangeNotice("2026-03-08", "America/New_York")).toContain(
      "there is no 02:00 to 02:59",
    );
    expect(clockChangeNotice("2026-03-29", "America/New_York")).toBeNull();
  });

  it("says half an hour for Lord Howe's shift", () => {
    expect(clockChangeNotice("2026-04-05", "Australia/Lord_Howe")).toContain("half an hour");
  });

  it("is silent for an unreadable day", () => {
    expect(clockChangeNotice("not-a-day", "Europe/London")).toBeNull();
  });
});
