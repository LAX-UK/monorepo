import { describe, expect, it } from "vitest";
import { manualReviewReasonLabel } from "./manual-review-presenter";

describe("manualReviewReasonLabel", () => {
  it("maps known finance and compliance reasons", () => {
    expect(manualReviewReasonLabel("aml_hold")).toBe("AML hold");
    expect(manualReviewReasonLabel("source_of_funds_required")).toBe("Source of funds required");
    expect(manualReviewReasonLabel("high_value")).toBe("High value");
  });

  it("falls back for unknown reasons", () => {
    expect(manualReviewReasonLabel("custom_reason")).toBe("custom reason");
    expect(manualReviewReasonLabel(null)).toBe("Manual review");
  });
});
