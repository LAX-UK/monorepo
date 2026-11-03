import { describe, expect, it } from "vitest";
import {
  CONFIRM_LINK_TTL_MS,
  CONFIRM_RESEND_INTERVAL_MS,
  evaluateConfirmation,
  maskEmail,
  nextStatus,
  normaliseAlertEmail,
  shouldSendConfirmation,
} from "./subscriber.js";

const now = new Date("2026-11-03T09:00:00Z");

describe("shouldSendConfirmation", () => {
  it("mails a new address and a stopped one, never a confirmed one", () => {
    expect(shouldSendConfirmation(null, now)).toBe(true);
    expect(shouldSendConfirmation({ status: "stopped", confirmationSentAt: now }, now)).toBe(true);
    expect(shouldSendConfirmation({ status: "confirmed", confirmationSentAt: now }, now)).toBe(
      false,
    );
  });

  it("mails a pending address again only after the pause", () => {
    const sent = (ago: number) => ({
      status: "pending" as const,
      confirmationSentAt: new Date(now.getTime() - ago),
    });
    expect(shouldSendConfirmation(sent(CONFIRM_RESEND_INTERVAL_MS - 1), now)).toBe(false);
    expect(shouldSendConfirmation(sent(CONFIRM_RESEND_INTERVAL_MS), now)).toBe(true);
    expect(shouldSendConfirmation({ status: "pending", confirmationSentAt: null }, now)).toBe(true);
  });
});

describe("evaluateConfirmation", () => {
  const requestedAt = new Date("2026-11-01T09:00:00Z");
  const at = requestedAt.getTime();
  it("confirms a pending row within 48 hours of the request the link names", () => {
    expect(evaluateConfirmation({ status: "pending", requestedAt }, at, new Date(at + 1000))).toBe(
      "confirmed",
    );
    expect(
      evaluateConfirmation(
        { status: "pending", requestedAt },
        at,
        new Date(at + CONFIRM_LINK_TTL_MS),
      ),
    ).toBe("confirmed");
    expect(
      evaluateConfirmation(
        { status: "pending", requestedAt },
        at,
        new Date(at + CONFIRM_LINK_TTL_MS + 1),
      ),
    ).toBe("expired");
  });

  it("rejects a link from an earlier request, a stopped row and a missing row", () => {
    expect(evaluateConfirmation({ status: "pending", requestedAt }, at - 1, now)).toBe("invalid");
    expect(evaluateConfirmation({ status: "stopped", requestedAt }, at, now)).toBe("invalid");
    expect(evaluateConfirmation(null, at, now)).toBe("invalid");
  });

  it("says a second press on a confirmed row is already confirmed", () => {
    expect(evaluateConfirmation({ status: "confirmed", requestedAt }, at, now)).toBe(
      "already_confirmed",
    );
  });
});

describe("nextStatus", () => {
  it("moves through the states the design draws", () => {
    expect(nextStatus(null, { type: "request" })).toBe("pending");
    expect(nextStatus("pending", { type: "request" })).toBe("pending");
    expect(nextStatus("stopped", { type: "request" })).toBe("pending");
    expect(nextStatus("confirmed", { type: "request" })).toBe("confirmed");
    expect(nextStatus("pending", { type: "confirm" })).toBe("confirmed");
    expect(nextStatus("stopped", { type: "confirm" })).toBeNull();
    expect(nextStatus("confirmed", { type: "confirm" })).toBeNull();
    expect(nextStatus(null, { type: "account_on" })).toBe("confirmed");
    expect(nextStatus("stopped", { type: "account_on" })).toBe("confirmed");
    expect(nextStatus("confirmed", { type: "stop", reason: "link" })).toBe("stopped");
    expect(nextStatus("pending", { type: "stop", reason: "complaint" })).toBe("stopped");
    expect(nextStatus(null, { type: "stop", reason: "link" })).toBeNull();
  });
});

describe("addresses", () => {
  it("normalises and masks", () => {
    expect(normaliseAlertEmail("  Mahmoud@Example.COM ")).toBe("mahmoud@example.com");
    expect(maskEmail("mahmoud@example.com")).toBe("m•••@example.com");
    expect(maskEmail("nonsense")).toBe("•••");
  });
});
