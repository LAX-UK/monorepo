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
    expect(manualReviewQueueEyebrow("aml_hold")).toBe("Compliance review");
    expect(manualReviewQueueEyebrow("high_value")).toBe("Finance review");
    expect(manualReviewQueueEyebrow(null)).toBe("Payment review");
  });
});
