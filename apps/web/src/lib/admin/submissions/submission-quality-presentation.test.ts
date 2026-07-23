import { buildSubmissionQualityPresentation } from "@/lib/admin/submissions/submission-quality-presentation";
import { describe, expect, it } from "vitest";

describe("buildSubmissionQualityPresentation", () => {
  it("returns typed required and warning gaps", () => {
    const presentation = buildSubmissionQualityPresentation({
      title: "",
      images: [],
      description: null,
      provenance: [],
      categoryId: "",
      categoryIds: [],
    });

    expect(presentation.blocksAccept).toBe(true);
    expect(presentation.gaps.some((gap) => gap.severity === "required")).toBe(true);
    expect(presentation.summaryLabel).toMatch(/required/i);
    expect(presentation.gaps.every((gap) => gap.description.length > 0)).toBe(true);
  });
});
