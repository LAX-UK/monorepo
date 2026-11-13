import { describe, expect, it } from "vitest";
import {
  lastTransferOutcomeUnknown,
  payoutTakesLines,
  transferFailureReason,
  transferOutcomeUnknownAfter,
} from "./payout-transfer-attempt.js";

describe("transferOutcomeUnknownAfter", () => {
  it("is unknown after a dropped connection, a Stripe server error or a key still in use", () => {
    expect(transferOutcomeUnknownAfter({ type: "StripeConnectionError" })).toBe(true);
    expect(transferOutcomeUnknownAfter({ type: "StripeAPIError" })).toBe(true);
    expect(
      transferOutcomeUnknownAfter({
        type: "StripeInvalidRequestError",
        code: "idempotency_key_in_use",
      }),
    ).toBe(true);
  });

  it("is known when Stripe refused the request", () => {
    expect(
      transferOutcomeUnknownAfter({
        type: "StripeInvalidRequestError",
        code: "balance_insufficient",
      }),
    ).toBe(false);
    expect(transferOutcomeUnknownAfter({ type: "StripeRateLimitError" })).toBe(false);
    expect(transferOutcomeUnknownAfter({})).toBe(false);
  });
});

describe("payoutTakesLines", () => {
  const unknown = transferFailureReason({
    outcomeUnknown: true,
    errorCode: "unknown",
    errorMessage: "socket hang up",
  });
  const refused = transferFailureReason({
    outcomeUnknown: false,
    errorCode: "balance_insufficient",
    errorMessage: "Insufficient funds",
  });

  it("takes lines while scheduled with no attempt, or after a refused one", () => {
    expect(payoutTakesLines({ status: "scheduled", failureReason: null })).toBe(true);
    expect(refused).toBe("stripe_transfer_failed: balance_insufficient - Insufficient funds");
    expect(payoutTakesLines({ status: "scheduled", failureReason: refused })).toBe(true);
  });

  it("takes none after an attempt whose outcome is unknown", () => {
    expect(lastTransferOutcomeUnknown({ failureReason: unknown })).toBe(true);
    expect(payoutTakesLines({ status: "scheduled", failureReason: unknown })).toBe(false);
  });

  it("takes none once the payout has left scheduled", () => {
    for (const status of ["in_transit", "paid", "failed", "transfer_blocked"] as const) {
      expect(payoutTakesLines({ status, failureReason: null })).toBe(false);
    }
  });
});
