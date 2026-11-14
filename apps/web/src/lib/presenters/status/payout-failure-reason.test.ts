import { describe, expect, it } from "vitest";
import {
  PAYOUT_FAILURE_REASON_FALLBACK,
  payoutFailureReasonLabel,
  presentPayoutFailureReason,
} from "./finance";

describe("presentPayoutFailureReason", () => {
  it("maps a known code with a detail suffix to staff copy and keeps the raw code", () => {
    const out = presentPayoutFailureReason(
      "manual_reconciliation_required: refunded after settlement window",
    );
    expect(out.text).toBe("Refunded after the settlement window. Reconcile this payout by hand.");
    expect(out.code).toBe("manual_reconciliation_required: refunded after settlement window");
  });

  it("maps a bare known code", () => {
    expect(presentPayoutFailureReason("insufficient_funds").text).toBe(
      payoutFailureReasonLabel.insufficient_funds,
    );
  });

  it("falls back to a generic sentence for an unknown code, never echoing it as the text", () => {
    const out = presentPayoutFailureReason("weird_new_code: boom");
    expect(out.text).toBe(PAYOUT_FAILURE_REASON_FALLBACK);
    expect(out.text).not.toContain("weird_new_code");
    expect(out.code).toBe("weird_new_code: boom");
  });

  it("does not treat object prototype keys as known codes", () => {
    expect(presentPayoutFailureReason("constructor").text).toBe(PAYOUT_FAILURE_REASON_FALLBACK);
  });

  it("every mapped sentence is plain copy, not a code", () => {
    for (const text of Object.values(payoutFailureReasonLabel)) {
      expect(text).toMatch(/^[A-Z].*\.$/);
      expect(text).not.toMatch(/_/);
    }
  });
});
