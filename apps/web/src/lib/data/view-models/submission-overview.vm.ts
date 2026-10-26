import { mapSubmissionQualityChecksToGapRows } from "@/lib/admin/detail-board/map-quality-gap-rows";
import { submissionDetailTabHref } from "@/lib/admin/submissions/submission-detail-routes";
import {
  formatQueueAgeCompareHint,
  submissionQueueAgeDays,
} from "@/lib/admin/submissions/submission-queue-age";
import { evaluateSubmissionQuality } from "@auction/domain";
import type { IssueItem, StatItem } from "@auction/staff-ui";
import type { ItemSubmission } from "@auction/types";

/** One fact about the work, as the seller gave it. `missing` marks a detail staff expect. */
export type SubmissionDetailRow = {
  id: string;
  label: string;
  value: string;
  missing: boolean;
};

export type SubmissionOverviewViewModel = {
  stats: StatItem[];
  /** What is wrong or missing, most serious first: quality gaps, then what is waiting on staff. */
  issues: IssueItem[];
  artworkRows: SubmissionDetailRow[];
  dimensionRows: SubmissionDetailRow[];
};

function hasAskingPrice(submission: ItemSubmission): boolean {
  const value = submission.askingPrice?.trim();
  return Boolean(value && value !== "—");
}

function categoryNames(
  submission: ItemSubmission,
  categories: readonly { id: string; name: string }[],
): string {
  const ids =
    submission.categoryIds && submission.categoryIds.length > 0
      ? submission.categoryIds
      : submission.categoryId
        ? [submission.categoryId]
        : [];
  const byId = new Map(categories.map((category) => [category.id, category.name]));
  return ids
    .map((id) => byId.get(id))
    .filter((name): name is string => Boolean(name))
    .join(", ");
}

export function buildSubmissionOverviewViewModel(input: {
  submissionId: string;
  submission: ItemSubmission;
  documentCount: number;
  avgQueueAgeDays?: number | null;
  categories?: readonly { id: string; name: string }[];
}): SubmissionOverviewViewModel {
  const { submissionId, submission: s, documentCount, avgQueueAgeDays = null } = input;
  const categories = input.categories ?? [];
  const quality = evaluateSubmissionQuality(s);
  const queueAgeDays = submissionQueueAgeDays(s.createdAt);
  const queueHint = formatQueueAgeCompareHint(queueAgeDays, avgQueueAgeDays);
  const decisionHref = submissionDetailTabHref(submissionId, "decision");

  const stats: StatItem[] = [
    {
      id: "queue-age",
      label: "Time since submitted",
      value: queueAgeDays === 1 ? "1 day" : `${queueAgeDays} days`,
      ...(queueHint ? { hint: queueHint } : {}),
      ...(queueHint === "Above avg" ? { hintTone: "negative" as const } : {}),
    },
    {
      id: "documents",
      label: "Documents",
      value: String(documentCount),
      hint: documentCount === 0 ? "No uploads" : "Attached",
    },
  ];

  const issues: IssueItem[] = mapSubmissionQualityChecksToGapRows(quality.checks).map((gap) => ({
    id: gap.id,
    label: gap.message,
    tone: gap.severity === "required" ? ("danger" as const) : ("warning" as const),
    tag: "Catalogue",
  }));

  if (!hasAskingPrice(s)) {
    issues.push({
      id: "missing-asking",
      label: "No asking price",
      tone: "warning",
      tag: "Commercial",
    });
  }
  if (documentCount === 0) {
    issues.push({
      id: "missing-documents",
      label: "No supporting documents",
      tone: "warning",
      tag: "Documents",
      action: { label: "View documents", href: submissionDetailTabHref(submissionId, "documents") },
    });
  }
  if (s.status === "submitted" || s.status === "under_review") {
    issues.push({
      id: "awaiting-review",
      label: s.status === "submitted" ? "Waiting for a reviewer to start" : "Review in progress",
      tone: s.status === "submitted" ? "danger" : "warning",
      tag: "Review",
      action: { label: "Open decision", href: decisionHref },
    });
  }
  if (s.status === "rejected" && !s.rejectionReason?.trim()) {
    issues.push({
      id: "missing-rejection-reason",
      label: "The rejection has no reason on record",
      tone: "warning",
      tag: "Review",
    });
  }

  const row = (
    id: string,
    label: string,
    value: string | null | undefined,
  ): SubmissionDetailRow => {
    const text = value?.trim() ?? "";
    return { id, label, value: text, missing: text === "" };
  };
  const failed = new Set(quality.checks.filter((check) => !check.ok).map((check) => check.id));

  return {
    stats,
    issues,
    artworkRows: [
      row("description", "Description", s.description),
      row("medium", "Medium", s.medium),
      {
        ...row("category", "Category", categoryNames(s, categories)),
        missing: failed.has("category"),
      },
      row("provenance", "Provenance", s.provenance?.join(" · ")),
      row("edition", "Edition", s.edition),
      row("year", "Year of work", s.yearOfWork),
      row("signed", "Signed", s.isSigned ? "Yes" : "No"),
      row("condition", "Condition (seller's view)", s.conditionSelfReport),
    ],
    dimensionRows: [
      row("dimensions", "Dimensions", s.dimensions),
      row("signature", "Signature", s.signatureNote),
    ],
  };
}
