import { describe, expect, it } from "vitest";
import {
  emptyWeek,
  openingHoursFormFromStored,
  openingHoursToStored,
  weekProblems,
  weekToRows,
} from "./editorial-opening-hours";

const SEEDED = [
  { label: "Tue – Sat", hours: "10:00 – 18:00" },
  { label: "Sun", hours: "12:00 – 17:00" },
  { label: "Mon", hours: "Closed" },
];

describe("openingHoursFormFromStored", () => {
  it("expands ranges and single days into the weekly editor", () => {
    const form = openingHoursFormFromStored(SEEDED);
    expect(form.mode).toBe("days");
    if (form.mode !== "days") return;
    expect(form.days.map((day) => day.state)).toEqual([
      "closed",
      "open",
      "open",
      "open",
      "open",
      "open",
      "open",
    ]);
    expect(form.days[2]).toEqual({ state: "open", opens: "10:00", closes: "18:00" });
    expect(form.days[6]).toEqual({ state: "open", opens: "12:00", closes: "17:00" });
  });

  it("reads the map form and long day names, and pads single-digit hours", () => {
    const form = openingHoursFormFromStored({ "Monday – Friday": "9:30-17:00" });
    expect(form.mode === "days" && form.days[0]).toEqual({
      state: "open",
      opens: "09:30",
      closes: "17:00",
    });
  });

  it("treats a missing value as an empty week", () => {
    expect(openingHoursFormFromStored(null)).toEqual({ mode: "days", days: emptyWeek() });
  });

  it.each([
    ["free text", "By appointment"],
    ["an unknown label", [{ label: "Bank holidays", hours: "Closed" }]],
    ["hours it cannot read", [{ label: "Mon", hours: "Morning only" }]],
    [
      "overlapping days",
      [
        { label: "Mon – Wed", hours: "10:00 – 18:00" },
        { label: "Wed", hours: "12:00 – 17:00" },
      ],
    ],
    ["a backwards range", [{ label: "Sat – Mon", hours: "10:00 – 18:00" }]],
  ])("leaves %s untouched rather than guessing", (_name, stored) => {
    const form = openingHoursFormFromStored(stored);
    expect(form).toEqual({ mode: "unrecognised", stored });
    expect(openingHoursToStored(form)).toBe(stored);
  });
});

describe("weekToRows", () => {
  it("joins consecutive identical days and skips unlisted ones", () => {
    const form = openingHoursFormFromStored(SEEDED);
    if (form.mode !== "days") throw new Error("expected days");
    expect(weekToRows(form.days)).toEqual([
      { label: "Mon", hours: "Closed" },
      { label: "Tue – Sat", hours: "10:00 – 18:00" },
      { label: "Sun", hours: "12:00 – 17:00" },
    ]);
  });

  it("does not join days that are separated by a different day", () => {
    const week = emptyWeek();
    week[0] = { state: "open", opens: "10:00", closes: "18:00" };
    week[1] = { state: "closed", opens: "", closes: "" };
    week[2] = { state: "open", opens: "10:00", closes: "18:00" };
    expect(weekToRows(week).map((row) => row.label)).toEqual(["Mon", "Tue", "Wed"]);
  });

  it("stores nothing when no day is listed", () => {
    expect(openingHoursToStored({ mode: "days", days: emptyWeek() })).toBeNull();
  });
});

describe("weekProblems", () => {
  it("flags open days without times and closing before opening", () => {
    const week = emptyWeek();
    week[0] = { state: "open", opens: "", closes: "" };
    week[1] = { state: "open", opens: "18:00", closes: "10:00" };
    week[2] = { state: "open", opens: "10:00", closes: "18:00" };
    expect(weekProblems(week)).toEqual({
      0: "Mon: enter opening and closing times.",
      1: "Tue: closing time must be after opening time.",
    });
  });
});
