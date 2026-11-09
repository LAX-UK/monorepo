import { describe, expect, it } from "vitest";
import {
  type CollectByPolicy,
  DEFAULT_COLLECT_BY_POLICY,
  collectBy,
  collectByRemindersDue,
} from "./collection-storage.js";

describe("the please-collect-by day", () => {
  it("is the London day payment cleared plus the free period, with its two reminder days", () => {
    // 23:30 UTC on 9 Nov is 23:30 GMT: the same London day.
    expect(collectBy(new Date("2026-11-09T23:30:00Z"))).toEqual({
      date: "2026-12-09",
      reminderDates: ["2026-12-02", "2026-12-09"],
    });
  });

  it("counts the London day in summer, not the UTC day", () => {
    // 23:30 UTC on 9 Jun is 00:30 BST on 10 Jun.
    expect(collectBy(new Date("2026-06-09T23:30:00Z")).date).toBe("2026-07-10");
  });
});

describe("the storage reminders due on a day", () => {
  it("goes a week before the deadline and on the day, each for the purchases cleared on one day", () => {
    expect(collectByRemindersDue("2026-12-02")).toEqual([
      { kind: "lead", clearedOn: "2026-11-09", collectBy: "2026-12-09" },
      { kind: "day", clearedOn: "2026-11-02", collectBy: "2026-12-02" },
    ]);
  });

  it("agrees with the please-collect-by day a purchase was given when it cleared", () => {
    const { date, reminderDates } = collectBy(new Date("2026-11-09T10:00:00Z"));
    const [lead, day] = reminderDates;
    expect(collectByRemindersDue(lead)[0]).toMatchObject({
      kind: "lead",
      clearedOn: "2026-11-09",
      collectBy: date,
    });
    expect(collectByRemindersDue(day)[1]).toMatchObject({
      kind: "day",
      clearedOn: "2026-11-09",
      collectBy: date,
    });
  });

  it("follows a place's own free period", () => {
    const policy: CollectByPolicy = { ...DEFAULT_COLLECT_BY_POLICY, freeStorageDays: 14 };
    expect(collectByRemindersDue("2026-11-30", policy)[0]).toMatchObject({
      clearedOn: "2026-11-23",
    });
  });

  it("has no early reminder when the free period is no longer than the lead", () => {
    const short: CollectByPolicy = { freeStorageDays: 7, reminderLeadDays: 7 };
    expect(collectByRemindersDue("2026-11-30", short).map((d) => d.kind)).toEqual(["day"]);
    expect(
      collectByRemindersDue("2026-11-30", { freeStorageDays: 3, reminderLeadDays: 7 }),
    ).toHaveLength(1);
  });
});
