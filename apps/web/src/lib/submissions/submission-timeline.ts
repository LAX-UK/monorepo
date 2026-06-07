import type { ItemSubmissionStatus, LotStatus } from "@auction/types";
import type { TimelineStage } from "@auction/ui/components/timeline-stages";

export const SUBMISSION_TIMELINE_STAGES: readonly TimelineStage[] = [
  { id: "draft", label: "Draft" },
  { id: "submitted", label: "Submitted" },
  { id: "review", label: "Under review" },
  { id: "accepted", label: "Accepted" },
  { id: "catalogue", label: "Catalogue prep" },
  { id: "listed", label: "Listed" },
] as const;

export function submissionTimelineActiveIndex(
  status: ItemSubmissionStatus,
  lotStatus?: LotStatus | null,
): number {
  switch (status) {
    case "draft":
      return 0;
    case "submitted":
      return 1;
    case "under_review":
      return 2;
    case "approved":
      return 3;
    case "converted":
      if (lotStatus === "active" || lotStatus === "ended") return 5;
      return 4;
    case "rejected":
    case "withdrawn":
      return 1;
    default:
      return 0;
  }
}
