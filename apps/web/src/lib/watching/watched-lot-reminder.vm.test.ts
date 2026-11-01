import { describe, expect, it } from "vitest";
import { defaultReminderKind, reminderOptions, reminderRowLabel } from "./watched-lot-reminder.vm";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-20T12:00:00Z");

describe("reminderOptions", () => {
  it("offers each time with when it would arrive", () => {
    const options = reminderOptions(
      { startsAt: now.getTime() + 6 * HOUR, closesAt: now.getTime() + 6 * 24 * HOUR },
      now,
    );
    expect(options.map((o) => o.value)).toEqual([
      "sale_start",
      "day_before_close",
      "hour_before_close",
    ]);
    expect(options.every((o) => !o.disabledReason && o.description.length > 0)).toBe(true);
    expect(defaultReminderKind(options)).toBe("day_before_close");
  });

  it("says why a time that has passed can't be chosen", () => {
    const options = reminderOptions(
      { startsAt: now.getTime() - HOUR, closesAt: now.getTime() + 3 * HOUR },
      now,
    );
    expect(options.find((o) => o.value === "sale_start")?.disabledReason).toBe(
      "The sale has started",
    );
    expect(options.find((o) => o.value === "day_before_close")?.disabledReason).toBe(
      "That time has passed",
    );
    expect(defaultReminderKind(options)).toBe("hour_before_close");
  });

  it("has nothing left for a lot about to close", () => {
    const options = reminderOptions(
      { startsAt: now.getTime() - HOUR, closesAt: now.getTime() + 10 * 60 * 1000 },
      now,
    );
    expect(defaultReminderKind(options)).toBeNull();
  });
});

describe("reminderRowLabel", () => {
  it("names the reminder on the row", () => {
    expect(reminderRowLabel({ kind: "day_before_close", note: null })).toBe(
      "reminder 1 day before",
    );
    expect(reminderRowLabel(null)).toBeNull();
  });
});
