import type { ManualReviewReason } from "@auction/types";
import { describe, expect, it } from "vitest";
import { manualReviewReasonLabel } from "./manual-review-presenter";
import { MANUAL_REVIEW_REASON_LABELS } from "./manual-review-reason.copy";

/** Written out in full, so a reason added to the type or dropped from the map fails here too. */
const REASONS = [
  "seller_archived",
  "high_value",
  "seller_archived_and_high_value",
  "aml_hold",
  "source_of_funds_required",
  "finance_release_required",
  "identity_verification_required",
  "organisation_under_review",
] satisfies ManualReviewReason[];

describe("manualReviewReasonLabel", () => {
  it("has a label for exactly the known reasons", () => {
    expect(Object.keys(MANUAL_REVIEW_REASON_LABELS).sort()).toEqual([...REASONS].sort());
  });

  it.each(Object.entries(MANUAL_REVIEW_REASON_LABELS))("labels %s as %s", (reason, label) => {
    expect(manualReviewReasonLabel(reason)).toBe(label);
    expect(label).toMatch(/^[A-Z]/);
    expect(label).not.toContain("_");
  });

  it("covers the two reasons that used to show as stored codes", () => {
    expect(manualReviewReasonLabel("identity_verification_required")).toBe(
      "Identity verification required",
    );
    expect(manualReviewReasonLabel("organisation_under_review")).toBe("Organisation under review");
  });

  it("falls back to sentence case for unknown reasons", () => {
    expect(manualReviewReasonLabel("custom_reason")).toBe("Custom reason");
    expect(manualReviewReasonLabel(null)).toBe("Manual review");
  });
});
