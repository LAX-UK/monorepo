import { submissionIsHighPriority } from "@/lib/admin/submissions/submission-queue-age";
import type { DotStatusPillTone } from "@auction/ui";

export type SubmissionPriorityPresentation = {
  label: "High" | "Normal";
  tone: DotStatusPillTone;
};

export function buildSubmissionPriorityPresentation(input: {
  isOverSla: boolean;
  hasRequiredQualityGaps: boolean;
}): SubmissionPriorityPresentation {
  const isHigh = submissionIsHighPriority(input);
  return {
    label: isHigh ? "High" : "Normal",
    tone: isHigh ? "critical" : "neutral",
  };
}
