import { describe, expect, it } from "vitest";
import {
  isComplianceManualReviewReason,
  manualReviewQueueEyebrow,
} from "./compliance-manual-review";

describe("compliance-manual-review", () => {
  it("detects compliance hold reasons", () => {
    expect(isComplianceManualReviewReason("aml_hold")).toBe(true);
    expect(isComplianceManualReviewReason("source_of_funds_required")).toBe(true);
    expect(isComplianceManualReviewReason("seller_archived")).toBe(false);
    expect(isComplianceManualReviewReason(null)).toBe(false);
  });

  it("labels checkout eyebrows by reason family", () => {
    expect(manualReviewQueueEyebrow("aml_hold")).toBe("More checks needed");
    expect(manualReviewQueueEyebrow("high_value")).toBe("Our team checks this payment");
    expect(manualReviewQueueEyebrow(null)).toBe("Payment being checked");
  });
});
