import { describe, expect, it } from "vitest";
import { buildSubmissionPriorityPresentation } from "./submission-priority-presentation";

describe("buildSubmissionPriorityPresentation", () => {
  it("marks high priority when over SLA", () => {
    const result = buildSubmissionPriorityPresentation({
      isOverSla: true,
      hasRequiredQualityGaps: false,
    });
    expect(result).toEqual({ label: "High", tone: "critical" });
  });

  it("marks normal priority when within SLA and no required gaps", () => {
    const result = buildSubmissionPriorityPresentation({
      isOverSla: false,
      hasRequiredQualityGaps: false,
    });
    expect(result).toEqual({ label: "Normal", tone: "neutral" });
  });
});
