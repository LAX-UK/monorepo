import type { ItemSubmissionStatus } from "@auction/types";
import type { TimelineStage } from "@auction/ui/components/timeline-stages";

export const SUBMISSION_TIMELINE_STAGES: readonly TimelineStage[] = [
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Submitted" },
  { id: "review", label: "Review" },
  { id: "listed", label: "Listed" },
] as const;

export function submissionTimelineActiveIndex(status: ItemSubmissionStatus): number {
  switch (status) {
    case "draft":
      return 0;
    case "submitted":
      return 1;
    case "under_review":
      return 2;
    case "approved":
    case "converted":
      return 3;
    case "rejected":
    case "withdrawn":
      return 1;
    default:
      return 0;
  }
}
