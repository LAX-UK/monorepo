import { describe, expect, it } from "vitest";
import {
  isPayoutReversalConfirmationValid,
  isPayoutReversalReasonValid,
  payoutReversalConfirmationPhrase,
} from "./payout-settlement.vm";

describe("payout-settlement.vm", () => {
  it("builds typed confirmation phrase", () => {
    expect(payoutReversalConfirmationPhrase("p1")).toBe("REVERSE PAYOUT p1");
    expect(isPayoutReversalConfirmationValid("p1", "REVERSE PAYOUT p1")).toBe(true);
  });

  it("validates reversal reason length", () => {
    expect(isPayoutReversalReasonValid("short")).toBe(false);
    expect(isPayoutReversalReasonValid("long enough reason")).toBe(true);
  });
});
