import { describe, expect, it } from "vitest";
import { ALERT_RETENTION, alertRetentionCutoffs } from "./retention.js";
import { CONFIRM_LINK_TTL_MS } from "./subscriber.js";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-06T03:00:00.000Z");

describe("alertRetentionCutoffs", () => {
  it("removes unconfirmed sign-ups 30 days after the request", () => {
    const { unconfirmedBefore } = alertRetentionCutoffs(now);
    expect(unconfirmedBefore.toISOString()).toBe("2026-10-07T03:00:00.000Z");
  });

  it("never cuts off an unconfirmed sign-up while its confirm link still works", () => {
    const { unconfirmedBefore } = alertRetentionCutoffs(now);
    expect(now.getTime() - unconfirmedBefore.getTime()).toBeGreaterThan(CONFIRM_LINK_TTL_MS);
  });

  it("keeps a stopped subscriber for 30 days after the stop", () => {
    const { stoppedBefore } = alertRetentionCutoffs(now);
    expect(now.getTime() - stoppedBefore.getTime()).toBe(30 * DAY);
  });

  it("keeps alert logs for 12 calendar months", () => {
    const { logsBefore } = alertRetentionCutoffs(now);
    expect(logsBefore.toISOString()).toBe("2025-11-06T03:00:00.000Z");
  });

  it("handles a leap day without producing an invalid date", () => {
    const { logsBefore } = alertRetentionCutoffs(new Date("2028-02-29T03:00:00.000Z"));
    expect(Number.isNaN(logsBefore.getTime())).toBe(false);
    expect(logsBefore.getUTCFullYear()).toBe(2027);
  });

  it("does not move the instant it was given", () => {
    const given = new Date(now);
    alertRetentionCutoffs(given);
    expect(given.getTime()).toBe(now.getTime());
  });

  it("states the periods the rules document", () => {
    expect(ALERT_RETENTION).toEqual({ unconfirmedDays: 30, stoppedDays: 30, logMonths: 12 });
  });
});
