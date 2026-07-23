import { evaluateSubmissionQuality } from "@auction/domain";
import type { ItemSubmission } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";

import {
  formatSubmissionSlaCountdownLabel,
  submissionIsHighPriority,
  submissionSlaHoursRemaining,
} from "@/lib/admin/submissions/submission-queue-age";
import { buildSubmissionSlaPresentation } from "@/lib/admin/submissions/submission-sla-presentation";

export type SubmissionHeaderBadge = {
  id: string;
  label: string;
  tone: DotStatusPillTone;
};

export function buildSubmissionHeaderBadges(submission: ItemSubmission): SubmissionHeaderBadge[] {
  const badges: SubmissionHeaderBadge[] = [];
  const quality = evaluateSubmissionQuality(submission);
  const sla = buildSubmissionSlaPresentation({
    status: submission.status,
    updatedAt: submission.updatedAt,
  });
  const hasRequiredQualityGaps = quality.checks.some((c) => c.severity === "required" && !c.ok);

  if (sla.days != null) {
    const hoursRemaining = submissionSlaHoursRemaining(submission.updatedAt);
    if (hoursRemaining != null) {
      const countdown = formatSubmissionSlaCountdownLabel(hoursRemaining);
      const atRisk = hoursRemaining <= 48 || sla.isOverSla;
      if (atRisk) {
        badges.push({
          id: "sla",
          label: sla.isOverSla ? `Over SLA — ${countdown}` : `SLA at risk — ${countdown}`,
          tone: sla.isOverSla ? "critical" : "warning",
        });
      }
    }
  }

  if (
    submissionIsHighPriority({
      isOverSla: sla.isOverSla,
      hasRequiredQualityGaps,
    })
  ) {
    badges.push({
      id: "priority",
      label: "High priority",
      tone: "critical",
    });
  }

  return badges;
}
