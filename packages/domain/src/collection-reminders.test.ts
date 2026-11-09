import { describe, expect, it } from "vitest";
import { reminderWindow } from "./collection-reminders.js";

const iso = (date: Date | undefined) => date?.toISOString();

describe("which visits are due a reminder", () => {
  it("is nothing before 09:00 in London", () => {
    expect(reminderWindow(new Date("2026-11-09T08:59:00Z"))).toBeNull();
  });

  it("is tomorrow's visits from 09:00, and visits last changed before that morning", () => {
    const window = reminderWindow(new Date("2026-11-09T09:00:00Z"));
    expect(iso(window?.from)).toBe("2026-11-10T00:00:00.000Z");
    expect(iso(window?.to)).toBe("2026-11-11T00:00:00.000Z");
    expect(iso(window?.changedBefore)).toBe("2026-11-09T09:00:00.000Z");
  });

  it("is the same answer all day, so the sweep can run as often as it likes", () => {
    const morning = reminderWindow(new Date("2026-11-09T09:00:00Z"));
    const evening = reminderWindow(new Date("2026-11-09T23:30:00Z"));
    expect(evening).toEqual(morning);
  });

  it("follows London time in summer: 09:00 BST is 08:00 UTC", () => {
    expect(reminderWindow(new Date("2026-07-09T07:59:00Z"))).toBeNull();
    const window = reminderWindow(new Date("2026-07-09T08:00:00Z"));
    expect(iso(window?.from)).toBe("2026-07-09T23:00:00.000Z");
    expect(iso(window?.to)).toBe("2026-07-10T23:00:00.000Z");
    expect(iso(window?.changedBefore)).toBe("2026-07-09T08:00:00.000Z");
  });

  it("treats a late evening in UTC as the next London day around midnight in summer", () => {
    // 23:30 UTC on 9 July is 00:30 BST on 10 July: the London day has already turned.
    expect(reminderWindow(new Date("2026-07-09T23:30:00Z"))).toBeNull();
  });

  it("covers the day the clocks go back: a 25-hour day", () => {
    // Sunday 25 Oct 2026: the clocks go back at 02:00 BST. The visit day is Sunday, so the
    // reminder goes on Saturday 24 Oct at 09:00 BST (08:00 UTC).
    const window = reminderWindow(new Date("2026-10-24T08:00:00Z"));
    expect(iso(window?.from)).toBe("2026-10-24T23:00:00.000Z");
    expect(iso(window?.to)).toBe("2026-10-26T00:00:00.000Z");
  });

  it("covers the day the clocks go forward: a 23-hour day", () => {
    // Sunday 29 Mar 2026: the clocks go forward at 01:00 GMT.
    const window = reminderWindow(new Date("2026-03-28T09:00:00Z"));
    expect(iso(window?.from)).toBe("2026-03-29T00:00:00.000Z");
    expect(iso(window?.to)).toBe("2026-03-29T23:00:00.000Z");
  });
});
