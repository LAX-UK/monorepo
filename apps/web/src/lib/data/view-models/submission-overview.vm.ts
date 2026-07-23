import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { applyFlatKpiTrendOverlay } from "@/lib/admin/apply-flat-kpi-trend-overlay";
import {
  detailStatRowFromQualityCheck,
  mapSubmissionQualityChecksToGapRows,
} from "@/lib/admin/detail-board/map-quality-gap-rows";
import type {
  DetailAttentionRow,
  DetailBoardKpiTile,
  DetailQualityGapRow,
  DetailStatRow,
} from "@/lib/admin/detail-board/types";
import {
  adminDateStatExtras,
  formatAdminTableDateTime,
} from "@/lib/admin/format-admin-table-datetime";
import { buildSubmissionAssigneePresentation } from "@/lib/admin/submissions/submission-assignee-presentation";
import { submissionDetailTabHref } from "@/lib/admin/submissions/submission-detail-routes";
import {
  formatQueueAgeCompareHint,
  submissionQueueAgeDays,
} from "@/lib/admin/submissions/submission-queue-age";
import { type SubmissionQualityCheck, evaluateSubmissionQuality } from "@auction/domain";
import type { ItemSubmission } from "@auction/types";

function qualityCheckById(
  checkById: Map<string, SubmissionQualityCheck>,
  id: string,
): SubmissionQualityCheck {
  const check = checkById.get(id);
  if (!check) {
    throw new Error(`Missing submission quality check: ${id}`);
  }
  return check;
}

export type SubmissionOverviewNextAction = {
  title: string;
  message: string;
  href: string;
  actionLabel: string;
};

export type SubmissionOverviewViewModel = {
  kpiTiles: DetailBoardKpiTile[];
  qualityGapRows: DetailQualityGapRow[];
  attentionRows: DetailAttentionRow[];
  artworkDetailRows: DetailStatRow[];
  dimensionRows: DetailStatRow[];
  internalRows: DetailStatRow[];
  nextAction: SubmissionOverviewNextAction | null;
};

function hasAskingPrice(submission: ItemSubmission): boolean {
  const value = submission.askingPrice?.trim();
  return Boolean(value && value !== "—");
}

function buildNextAction(
  submissionId: string,
  status: ItemSubmission["status"],
): SubmissionOverviewNextAction | null {
  const decisionHref = submissionDetailTabHref(submissionId, "decision");

  if (status === "submitted") {
    return {
      title: "Awaiting staff review",
      message: "This submission is awaiting review. Open the decision tab to start review.",
      href: decisionHref,
      actionLabel: "Open decision",
    };
  }

  if (status === "under_review") {
    return {
      title: "Review in progress",
      message: "Complete approve, reject, or convert actions on the decision tab.",
      href: decisionHref,
      actionLabel: "Open decision",
    };
  }

  if (status === "approved") {
    return {
      title: "Ready to convert",
      message: "Approve catalogue details and convert this submission into a lot.",
      href: decisionHref,
      actionLabel: "Convert to lot",
    };
  }

  return null;
}

function categoryLabel(
  submission: ItemSubmission,
  categories: readonly { id: string; name: string }[],
): string {
  const ids =
    submission.categoryIds && submission.categoryIds.length > 0
      ? submission.categoryIds
      : submission.categoryId
        ? [submission.categoryId]
        : [];
  if (ids.length === 0) return "—";
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  return ids.map((id) => byId.get(id) ?? id).join(", ");
}

function withFlatKpiOverlay(
  tile: DetailBoardKpiTile,
  snapshot: number,
  periodDays: AdminKpiPeriodDays,
): DetailBoardKpiTile {
  const overlay = applyFlatKpiTrendOverlay(snapshot, periodDays);
  return {
    ...tile,
    ...overlay,
    ...(tile.compareHint ? { compareHint: tile.compareHint } : {}),
  };
}

export function buildSubmissionOverviewViewModel(input: {
  submissionId: string;
  submission: ItemSubmission;
  documentCount: number;
  submitterDisplayName: string | null;
  currentUserId: string;
  assigneeDisplayName?: string | null;
  avgQueueAgeDays?: number | null;
  categories?: readonly { id: string; name: string }[];
}): SubmissionOverviewViewModel {
  const {
    submissionId,
    submission,
    documentCount,
    submitterDisplayName,
    currentUserId,
    avgQueueAgeDays = null,
    categories = [],
  } = input;
  const s = submission;
  const quality = evaluateSubmissionQuality(s);
  const qualityGapRows = mapSubmissionQualityChecksToGapRows(quality.checks);

  const assignee = buildSubmissionAssigneePresentation({
    assignedToUserId: s.assignedToUserId,
    currentUserId,
    ...(input.assigneeDisplayName != null
      ? { assigneeDisplayName: input.assigneeDisplayName }
      : {}),
  });
  const queueAgeDays = submissionQueueAgeDays(s.createdAt);
  const documentsHint = documentCount === 0 ? "No uploads" : "View documents";

  const assigneeCompareHint = assignee.isUnassigned
    ? s.status === "submitted" || s.status === "under_review"
      ? "Take ownership"
      : undefined
    : assignee.isCurrentUser
      ? "Assigned to you"
      : (input.assigneeDisplayName ?? undefined);

  const queueAgeCompareHint = formatQueueAgeCompareHint(queueAgeDays, avgQueueAgeDays);
  const periodDays: AdminKpiPeriodDays = 30;

  const kpiTiles: DetailBoardKpiTile[] = [
    withFlatKpiOverlay(
      {
        id: "assignee",
        label: "Assigned to",
        value: assignee.label,
        ...(assigneeCompareHint ? { compareHint: assigneeCompareHint } : {}),
        trendTone: assignee.isUnassigned ? "secondary" : "info",
      },
      assignee.isUnassigned ? 0 : 1,
      periodDays,
    ),
    withFlatKpiOverlay(
      {
        id: "queue-age",
        label: "Time in review",
        value: queueAgeDays === 1 ? "1 day" : `${queueAgeDays} days`,
        ...(queueAgeCompareHint ? { compareHint: queueAgeCompareHint } : {}),
        trendTone:
          avgQueueAgeDays != null && queueAgeDays > avgQueueAgeDays ? "accent-gold" : "muted",
      },
      queueAgeDays,
      periodDays,
    ),
    withFlatKpiOverlay(
      {
        id: "documents",
        label: "Documents",
        value: String(documentCount),
        compareHint: documentsHint,
        trendTone: documentCount === 0 ? "secondary" : "info",
      },
      documentCount,
      periodDays,
    ),
  ];

  const attentionRows: DetailAttentionRow[] = [];

  if (s.images.length === 0) {
    attentionRows.push({
      id: "missing-images",
      title: "No catalogue images",
      count: 1,
      category: "Catalogue",
      severity: "high",
      actionLabel: "Review submission",
      href: submissionDetailTabHref(submissionId, "decision"),
      iconKind: "catalog",
    });
  }

  if (!hasAskingPrice(s)) {
    attentionRows.push({
      id: "missing-asking",
      title: "No asking price",
      count: 1,
      category: "Commercial",
      severity: "medium",
      actionLabel: "Review submission",
      href: submissionDetailTabHref(submissionId, "decision"),
      iconKind: "finance",
    });
  }

  if (documentCount === 0) {
    attentionRows.push({
      id: "missing-documents",
      title: "No supporting documents",
      count: 1,
      category: "Documents",
      severity: "medium",
      actionLabel: "View documents",
      href: submissionDetailTabHref(submissionId, "documents"),
      iconKind: "general",
    });
  }

  if (s.status === "submitted" || s.status === "under_review") {
    attentionRows.push({
      id: "awaiting-review",
      title: "Awaiting staff action",
      count: 1,
      category: "Review",
      severity: s.status === "submitted" ? "critical" : "high",
      actionLabel: "Open decision",
      href: submissionDetailTabHref(submissionId, "decision"),
      iconKind: "setup",
    });
  }

  if (s.status === "rejected" && !s.rejectionReason?.trim()) {
    attentionRows.push({
      id: "missing-rejection-reason",
      title: "Rejection reason missing",
      count: 1,
      category: "Review",
      severity: "medium",
      actionLabel: "Open decision",
      href: submissionDetailTabHref(submissionId, "decision"),
      iconKind: "general",
    });
  }

  const checkById = new Map(quality.checks.map((c) => [c.id, c]));

  const artworkDetailRows: DetailStatRow[] = [
    detailStatRowFromQualityCheck(qualityCheckById(checkById, "title"), s.title?.trim() || "—"),
    detailStatRowFromQualityCheck(
      qualityCheckById(checkById, "description"),
      s.description?.trim() || "—",
    ),
    detailStatRowFromQualityCheck(qualityCheckById(checkById, "medium"), s.medium?.trim() || "—"),
    detailStatRowFromQualityCheck(
      qualityCheckById(checkById, "category"),
      categoryLabel(s, categories),
    ),
    detailStatRowFromQualityCheck(
      qualityCheckById(checkById, "provenance"),
      s.provenance?.length ? s.provenance.join(" · ") : "—",
    ),
  ];

  const dimensionRows: DetailStatRow[] = [
    detailStatRowFromQualityCheck(
      qualityCheckById(checkById, "dimensions"),
      s.dimensions?.trim() || "—",
    ),
    detailStatRowFromQualityCheck(
      qualityCheckById(checkById, "signature"),
      s.signatureNote?.trim() || "—",
    ),
  ];

  const internalRows: DetailStatRow[] = [
    { id: "id", label: "Submission ID", value: s.id },
    {
      id: "asking",
      label: "Asking / reserve",
      value: `${s.askingPrice ?? "—"} · ${s.reservePrice ?? "—"}`,
    },
    {
      id: "lot",
      label: "Converted lot ID",
      value: s.convertedLotId ?? "—",
    },
    ...(submitterDisplayName || s.legalEntityId || s.sellerId
      ? [
          {
            id: "seller",
            label: "Legal entity / seller",
            value: [
              submitterDisplayName,
              s.legalEntityId ? `Legal entity: ${s.legalEntityId}` : null,
              s.sellerId ? `Seller (legacy): ${s.sellerId}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        ]
      : []),
    {
      id: "created",
      label: "Created",
      value: formatAdminTableDateTime(s.createdAt, "timestamp").primary,
      ...adminDateStatExtras(s.createdAt, "timestamp"),
    },
    {
      id: "updated",
      label: "Last updated",
      value: formatAdminTableDateTime(s.updatedAt, "timestamp").primary,
      ...adminDateStatExtras(s.updatedAt, "timestamp"),
    },
    {
      id: "reviewed",
      label: "Reviewed",
      value: s.reviewedAt
        ? `${formatAdminTableDateTime(s.reviewedAt, "timestamp").primary}${s.reviewedBy ? ` by ${s.reviewedBy.slice(0, 8)}…` : ""}`
        : "—",
      ...adminDateStatExtras(s.reviewedAt, "timestamp"),
    },
    {
      id: "notes",
      label: "Staff review notes on record",
      value: s.reviewNotes ?? "—",
    },
  ];

  return {
    kpiTiles,
    qualityGapRows,
    attentionRows,
    artworkDetailRows,
    dimensionRows,
    internalRows,
    nextAction: buildNextAction(submissionId, s.status),
  };
}
