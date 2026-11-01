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

/** The countdown already says "Over SLA" once the deadline has passed; say it once. */
export function slaBadgeLabel(isOverSla: boolean, countdown: string): string {
  if (!isOverSla) return `SLA at risk — ${countdown}`;
  return countdown.startsWith("Over SLA") ? countdown : `Over SLA — ${countdown}`;
}

export function buildSubmissionHeaderBadges(submission: ItemSubmission): SubmissionHeaderBadge[] {
  const badges: SubmissionHeaderBadge[] = [];
  const quality = evaluateSubmissionQuality(submission);
  const sla = buildSubmissionSlaPresentation({
    status: submission.status,
    updatedAt: submission.updatedAt,
    convertedLotId: submission.convertedLotId,
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
          label: slaBadgeLabel(sla.isOverSla, countdown),
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
