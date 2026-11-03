import { describe, expect, it } from "vitest";
import {
  VISITOR_ALERT_CONFIRM_TTL_MS,
  VISITOR_ALERT_RESEND_INTERVAL_MS,
  evaluateConfirmation,
  normaliseAlertEmail,
  receivesSaleAlerts,
  shouldSendConfirmation,
} from "./visitor-sale-alerts.js";

const now = new Date("2026-11-02T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("normaliseAlertEmail", () => {
  it("trims and lower-cases", () => {
    expect(normaliseAlertEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("shouldSendConfirmation", () => {
  it("mails a new address", () => {
    expect(shouldSendConfirmation(null, now)).toBe(true);
  });

  it("never mails a confirmed address again", () => {
    expect(shouldSendConfirmation({ status: "confirmed", confirmationSentAt: ago(1e9) }, now)).toBe(
      false,
    );
  });

  it("asks an unsubscribed address to consent again", () => {
    expect(
      shouldSendConfirmation({ status: "unsubscribed", confirmationSentAt: ago(1000) }, now),
    ).toBe(true);
  });

  it("holds back a repeat request for a pending address until the pause has passed", () => {
    const pending = (ms: number) => ({
      status: "pending" as const,
      confirmationSentAt: ago(ms),
    });
    expect(shouldSendConfirmation(pending(VISITOR_ALERT_RESEND_INTERVAL_MS - 1), now)).toBe(false);
    expect(shouldSendConfirmation(pending(VISITOR_ALERT_RESEND_INTERVAL_MS), now)).toBe(true);
    expect(shouldSendConfirmation({ status: "pending", confirmationSentAt: null }, now)).toBe(true);
  });
});

describe("evaluateConfirmation", () => {
  const requestedAt = ago(60_000);
  const pending = { status: "pending" as const, requestedAt };

  it("confirms a pending address with the current link", () => {
    expect(evaluateConfirmation(pending, requestedAt.getTime(), now)).toBe("confirmed");
  });

  it("treats a repeat click as already confirmed", () => {
    expect(
      evaluateConfirmation({ status: "confirmed", requestedAt }, requestedAt.getTime(), now),
    ).toBe("already_confirmed");
  });

  it("expires after the time limit", () => {
    const old = ago(VISITOR_ALERT_CONFIRM_TTL_MS + 1);
    expect(evaluateConfirmation({ status: "pending", requestedAt: old }, old.getTime(), now)).toBe(
      "expired",
    );
  });

  it("rejects an unknown address, a superseded link and an unsubscribed address", () => {
    expect(evaluateConfirmation(null, 1, now)).toBe("invalid");
    expect(evaluateConfirmation(pending, requestedAt.getTime() - 1, now)).toBe("invalid");
    expect(
      evaluateConfirmation({ status: "unsubscribed", requestedAt }, requestedAt.getTime(), now),
    ).toBe("invalid");
  });
});

describe("receivesSaleAlerts", () => {
  it("is true only once confirmed", () => {
    expect(receivesSaleAlerts("confirmed")).toBe(true);
    expect(receivesSaleAlerts("pending")).toBe(false);
    expect(receivesSaleAlerts("unsubscribed")).toBe(false);
  });
});
