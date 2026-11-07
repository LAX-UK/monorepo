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

  it("keeps a stopped subscriber, and its consent evidence, for 2 years after the stop", () => {
    const { stoppedBefore } = alertRetentionCutoffs(now);
    expect(now.getTime() - stoppedBefore.getTime()).toBe(730 * DAY);
    expect(stoppedBefore.toISOString()).toBe("2024-11-06T03:00:00.000Z");
  });

  it("keeps alert logs for 90 days", () => {
    const { logsBefore } = alertRetentionCutoffs(now);
    expect(now.getTime() - logsBefore.getTime()).toBe(90 * DAY);
    expect(logsBefore.toISOString()).toBe("2026-08-08T03:00:00.000Z");
  });

  it("keeps the evidence far longer than the logs", () => {
    const { stoppedBefore, logsBefore } = alertRetentionCutoffs(now);
    expect(stoppedBefore.getTime()).toBeLessThan(logsBefore.getTime());
  });

  it("handles a leap day without producing an invalid date", () => {
    const { logsBefore, stoppedBefore } = alertRetentionCutoffs(
      new Date("2028-02-29T03:00:00.000Z"),
    );
    expect(Number.isNaN(logsBefore.getTime())).toBe(false);
    expect(logsBefore.toISOString()).toBe("2027-12-01T03:00:00.000Z");
    expect(Number.isNaN(stoppedBefore.getTime())).toBe(false);
  });

  it("does not move the instant it was given", () => {
    const given = new Date(now);
    alertRetentionCutoffs(given);
    expect(given.getTime()).toBe(now.getTime());
  });

  it("states the periods the rules document", () => {
    expect(ALERT_RETENTION).toEqual({ unconfirmedDays: 30, stoppedDays: 730, logDays: 90 });
  });
});
