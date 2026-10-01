import { describe, expect, it } from "vitest";
import { evaluatePayoutEligibility } from "./payout-eligibility.js";

describe("evaluatePayoutEligibility", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");

  it("moves to due when cancellation and funds gates pass", () => {
    expect(
      evaluatePayoutEligibility({
        status: "pending_refund_period",
        blockedReason: null,
        cancellationPeriodEndsAt: new Date("2026-09-01T00:00:00.000Z"),
        fundsAvailableAt: new Date("2026-09-15T00:00:00.000Z"),
        payeeComplianceBlocked: false,
        now,
      }),
    ).toEqual({ eligible: true, nextStatus: "due" });
  });

  it("blocks while cancellation period is open", () => {
    expect(
      evaluatePayoutEligibility({
        status: "pending_refund_period",
        blockedReason: null,
        cancellationPeriodEndsAt: new Date("2026-11-01T00:00:00.000Z"),
        fundsAvailableAt: null,
        payeeComplianceBlocked: false,
        now,
      }),
    ).toEqual({ eligible: false, reason: "cancellation_period_open" });
  });
});
