import { describe, expect, it } from "vitest";
import { MANUAL_REVIEW_REASON_LABELS } from "./manual-review-reason.copy";
import { manualReviewReasonLabel } from "./manual-review-presenter";

describe("manualReviewReasonLabel", () => {
  it.each(Object.entries(MANUAL_REVIEW_REASON_LABELS))("labels %s as %s", (reason, label) => {
    expect(manualReviewReasonLabel(reason)).toBe(label);
    expect(label).toMatch(/^[A-Z]/);
    expect(label).not.toContain("_");
  });

  it("covers the two reasons that used to show as stored codes", () => {
    expect(manualReviewReasonLabel("identity_verification_required")).toBe(
      "Identity verification required",
    );
    expect(manualReviewReasonLabel("organisation_under_review")).toBe(
      "Organisation under review",
    );
  });

  it("falls back to sentence case for unknown reasons", () => {
    expect(manualReviewReasonLabel("custom_reason")).toBe("Custom reason");
    expect(manualReviewReasonLabel(null)).toBe("Manual review");
  });
});
