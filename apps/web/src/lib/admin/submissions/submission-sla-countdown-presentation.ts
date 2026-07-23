import {
  formatSubmissionSlaCountdownDetailed,
  submissionSlaHoursRemaining,
} from "@/lib/admin/submissions/submission-queue-age";
import type { ItemSubmissionStatus } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";

export type SubmissionSlaCountdownPresentation = {
  label: string | null;
  tone: DotStatusPillTone | null;
};

export function buildSubmissionSlaCountdownPresentation(input: {
  status: ItemSubmissionStatus;
  updatedAt: Date;
  isOverSla: boolean;
  now?: number;
}): SubmissionSlaCountdownPresentation {
  if (
    input.status !== "submitted" &&
    input.status !== "under_review" &&
    input.status !== "approved"
  ) {
    return { label: null, tone: null };
  }

  const hoursRemaining = submissionSlaHoursRemaining(input.updatedAt, input.now);
  if (hoursRemaining == null) {
    return { label: null, tone: null };
  }

  const label = formatSubmissionSlaCountdownDetailed(hoursRemaining);
  const tone: DotStatusPillTone = input.isOverSla
    ? "critical"
    : hoursRemaining <= 48
      ? "warning"
      : "neutral";

  return { label, tone };
}
