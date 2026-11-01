import { describe, expect, it } from "vitest";
import {
  watchedLotReminderDueAt,
  watchedLotReminderNotice,
  watchedLotReminderStep,
} from "./watched-lot-reminder.js";

const at = (iso: string) => new Date(iso);
const lot = {
  startTime: at("2026-11-20T18:00:00Z"),
  endTime: at("2026-11-26T18:00:00Z"),
  closed: false,
};

describe("watchedLotReminderDueAt", () => {
  it("follows the lot's own times", () => {
    expect(watchedLotReminderDueAt("sale_start", lot)).toEqual(at("2026-11-20T18:00:00Z"));
    expect(watchedLotReminderDueAt("day_before_close", lot)).toEqual(at("2026-11-25T18:00:00Z"));
    expect(watchedLotReminderDueAt("hour_before_close", lot)).toEqual(at("2026-11-26T17:00:00Z"));
  });

  it("is unknown while the lot has no time", () => {
    expect(watchedLotReminderDueAt("hour_before_close", { startTime: null, endTime: null })).toBe(
      null,
    );
  });
});

describe("watchedLotReminderStep", () => {
  it("waits until due, then sends", () => {
    expect(watchedLotReminderStep("hour_before_close", lot, at("2026-11-26T16:59:00Z"))).toBe(
      "wait",
    );
    expect(watchedLotReminderStep("hour_before_close", lot, at("2026-11-26T17:00:00Z"))).toBe(
      "send",
    );
  });

  it("follows a close that moved later", () => {
    const extended = { ...lot, endTime: at("2026-11-27T18:00:00Z") };
    expect(watchedLotReminderStep("day_before_close", extended, at("2026-11-25T19:00:00Z"))).toBe(
      "wait",
    );
  });

  it("drops a reminder whose moment passed instead of sending it late", () => {
    expect(
      watchedLotReminderStep(
        "day_before_close",
        { ...lot, closed: true },
        at("2026-11-25T19:00:00Z"),
      ),
    ).toBe("expire");
    expect(watchedLotReminderStep("hour_before_close", lot, at("2026-11-26T18:00:01Z"))).toBe(
      "expire",
    );
    expect(watchedLotReminderStep("sale_start", lot, at("2026-11-20T19:30:00Z"))).toBe("expire");
    expect(watchedLotReminderStep("sale_start", lot, at("2026-11-20T18:20:00Z"))).toBe("send");
  });
});

describe("watchedLotReminderNotice", () => {
  it("says when, with the person's note", () => {
    expect(
      watchedLotReminderNotice({
        kind: "hour_before_close",
        lotTitle: "Red chair, evening",
        note: " Check the frame ",
      }),
    ).toEqual({
      title: 'Reminder: "Red chair, evening"',
      message: "It closes in about an hour. Your note: Check the frame",
    });
    expect(
      watchedLotReminderNotice({ kind: "sale_start", lotTitle: "Red chair", note: null }).message,
    ).toBe("Bidding has opened.");
  });
});
