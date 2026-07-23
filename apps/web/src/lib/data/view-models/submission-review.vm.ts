import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import { relativeFromIso } from "@/lib/admin/relative-time";
import { resolveSubmissionDecisionView } from "@/lib/admin/submissions/resolve-submission-decision-view";
import { buildSubmissionAssigneePresentation } from "@/lib/admin/submissions/submission-assignee-presentation";
import { buildSubmissionPriorityPresentation } from "@/lib/admin/submissions/submission-priority-presentation";
import { buildSubmissionQualityPresentation } from "@/lib/admin/submissions/submission-quality-presentation";
import { buildSubmissionSlaCountdownPresentation } from "@/lib/admin/submissions/submission-sla-countdown-presentation";
import { buildSubmissionSlaPresentation } from "@/lib/admin/submissions/submission-sla-presentation";
import { evaluateSubmissionQuality } from "@auction/domain";
import type { ItemSubmission } from "@auction/types";

export type SubmissionReviewMediaItem = {
  id: string;
  url: string;
  label: string;
};

export type SubmissionReviewViewModel = {
  submissionId: string;
  title: string;
  status: ItemSubmission["status"];
  sellerPreview: string;
  categoryPreview: string | null;
  categoryName: string | null;
  medium: string | null;
  edition: string | null;
  createdAtLabel: string;
  askingPrice: string | null;
  reservePrice: string | null;
  media: SubmissionReviewMediaItem[];
  quality: ReturnType<typeof buildSubmissionQualityPresentation>;
  sla: ReturnType<typeof buildSubmissionSlaPresentation>;
  slaCountdown: ReturnType<typeof buildSubmissionSlaCountdownPresentation>;
  priority: ReturnType<typeof buildSubmissionPriorityPresentation>;
  submittedLabel: string;
  assignee: ReturnType<typeof buildSubmissionAssigneePresentation>;
  decisionView: ReturnType<typeof resolveSubmissionDecisionView>;
  submitterNotes: string | null;
};

export function buildSubmissionReviewViewModel(input: {
  submission: ItemSubmission;
  currentUserId: string;
  sellerPreview: string;
  categoryPreview?: string | null;
  categoryName?: string | null;
  assigneeDisplayName?: string | null;
}): SubmissionReviewViewModel {
  const { submission, currentUserId, sellerPreview } = input;
  const quality = evaluateSubmissionQuality(submission);
  const qualityPresentation = buildSubmissionQualityPresentation(submission);
  const sla = buildSubmissionSlaPresentation({
    status: submission.status,
    updatedAt: submission.updatedAt,
  });
  const hasRequiredQualityGaps = quality.checks.some(
    (check) => check.severity === "required" && !check.ok,
  );

  return {
    submissionId: submission.id,
    title: submission.title,
    status: submission.status,
    sellerPreview,
    categoryPreview: input.categoryPreview ?? submission.medium?.trim() ?? null,
    categoryName: input.categoryName ?? null,
    medium: submission.medium,
    edition: submission.edition ?? null,
    createdAtLabel: formatAdminTableDateTime(submission.createdAt, "timestamp").primary,
    submittedLabel: relativeFromIso(submission.createdAt.toISOString()),
    askingPrice: submission.askingPrice,
    reservePrice: submission.reservePrice,
    media: submission.images.map((url, index) => ({
      id: `image-${index}`,
      url,
      label: `Image ${index + 1}`,
    })),
    quality: qualityPresentation,
    sla,
    slaCountdown: buildSubmissionSlaCountdownPresentation({
      status: submission.status,
      updatedAt: submission.updatedAt,
      isOverSla: sla.isOverSla,
    }),
    priority: buildSubmissionPriorityPresentation({
      isOverSla: sla.isOverSla,
      hasRequiredQualityGaps,
    }),
    assignee: buildSubmissionAssigneePresentation({
      assignedToUserId: submission.assignedToUserId,
      currentUserId,
      ...(input.assigneeDisplayName != null
        ? { assigneeDisplayName: input.assigneeDisplayName }
        : {}),
    }),
    decisionView: resolveSubmissionDecisionView(submission.status),
    submitterNotes: submission.submitterNotes,
  };
}
