import { describe, expect, it } from "vitest";
import {
  RELEASE_ALERT_CONFIRM_TTL_MS,
  RELEASE_ALERT_RESEND_AFTER_MS,
  evaluateReleaseAlertConfirmation,
  isShopEditionRelease,
  shouldSendReleaseAlertConfirmation,
} from "./release-alert.js";

const now = new Date("2026-11-02T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("shouldSendReleaseAlertConfirmation", () => {
  it("sends to an address that is new or was stopped", () => {
    expect(shouldSendReleaseAlertConfirmation(null, now)).toBe(true);
    expect(
      shouldSendReleaseAlertConfirmation({ status: "stopped", confirmRequestedAt: null }, now),
    ).toBe(true);
  });

  it("sends nothing to a confirmed address", () => {
    expect(
      shouldSendReleaseAlertConfirmation({ status: "confirmed", confirmRequestedAt: null }, now),
    ).toBe(false);
  });

  it("waits before sending a second email to an address still waiting", () => {
    const waiting = (msAgo: number) => ({
      status: "pending" as const,
      confirmRequestedAt: ago(msAgo),
    });
    const recent = waiting(RELEASE_ALERT_RESEND_AFTER_MS - 1);
    const older = waiting(RELEASE_ALERT_RESEND_AFTER_MS);
    expect(shouldSendReleaseAlertConfirmation(recent, now)).toBe(false);
    expect(shouldSendReleaseAlertConfirmation(older, now)).toBe(true);
  });
});

describe("evaluateReleaseAlertConfirmation", () => {
  it("confirms a waiting address inside the window", () => {
    const row = { status: "pending", confirmRequestedAt: ago(1000) } as const;
    expect(evaluateReleaseAlertConfirmation(row, now)).toBe("confirmed");
  });

  it("expires a link older than the window", () => {
    const row = {
      status: "pending" as const,
      confirmRequestedAt: ago(RELEASE_ALERT_CONFIRM_TTL_MS + 1),
    };
    expect(evaluateReleaseAlertConfirmation(row, now)).toBe("expired");
  });

  it("treats a second click as done, and a stopped or unknown address as invalid", () => {
    expect(
      evaluateReleaseAlertConfirmation({ status: "confirmed", confirmRequestedAt: null }, now),
    ).toBe("already_confirmed");
    expect(
      evaluateReleaseAlertConfirmation({ status: "stopped", confirmRequestedAt: ago(1) }, now),
    ).toBe("invalid");
    expect(evaluateReleaseAlertConfirmation(null, now)).toBe("invalid");
  });
});

describe("isShopEditionRelease", () => {
  it("counts only editions sold in the Shop", () => {
    expect(isShopEditionRelease({ salesChannel: "shop", eligibleForEditionAllocation: true })).toBe(
      true,
    );
    expect(isShopEditionRelease({ salesChannel: "art", eligibleForEditionAllocation: true })).toBe(
      false,
    );
    expect(
      isShopEditionRelease({ salesChannel: "shop", eligibleForEditionAllocation: false }),
    ).toBe(false);
  });
});
