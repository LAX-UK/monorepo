import type { AdminSubmissionTableRow } from "@/lib/admin/catalog/submission-table-row";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
import { buildSubmissionAssigneePresentation } from "@/lib/admin/submissions/submission-assignee-presentation";
import {
  buildSubmissionQualityPresentation,
  submissionQualityWarningLabels,
} from "@/lib/admin/submissions/submission-quality-presentation";
import { buildSubmissionSlaPresentation } from "@/lib/admin/submissions/submission-sla-presentation";
import type { getAdminSubmissions } from "@/lib/data/http/submissions.server";
import type { ItemSubmission } from "@auction/types";
import { toRequiredIsoString } from "@auction/validators";

type AdminSubmissionListRow = Awaited<ReturnType<typeof getAdminSubmissions>>["rows"][number];

export type AdminSubmissionTableRowOptions = {
  currentUserId: string;
  sellerNamesById?: ReadonlyMap<string, string | null>;
  categoryNamesById?: ReadonlyMap<string, string | null>;
  assigneeNamesById?: ReadonlyMap<string, string | null>;
  now?: number;
};

function resolveSellerId(row: ItemSubmission): string {
  return row.legalEntityId ?? row.sellerId ?? "";
}

function resolveSellerPreview(
  entityId: string,
  sellerNamesById: ReadonlyMap<string, string | null> | undefined,
): string {
  if (!entityId) return "Unknown seller";
  return sellerNamesById?.get(entityId) ?? `ID: ${entityId.slice(0, 8)}…`;
}

function resolveCategoryPreview(
  row: ItemSubmission,
  categoryNamesById: ReadonlyMap<string, string | null> | undefined,
): string | null {
  const categoryId = row.categoryIds?.[0] ?? row.categoryId?.trim() ?? "";
  if (!categoryId) return row.medium?.trim() || null;
  const categoryName = categoryNamesById?.get(categoryId);
  if (categoryName && row.medium?.trim()) return `${categoryName} · ${row.medium.trim()}`;
  return categoryName ?? row.medium?.trim() ?? null;
}

export function toAdminSubmissionTableRow(
  row: AdminSubmissionListRow,
  options: AdminSubmissionTableRowOptions,
): AdminSubmissionTableRow {
  const entityId = resolveSellerId(row);
  const quality = buildSubmissionQualityPresentation(row);
  const sla = buildSubmissionSlaPresentation({
    status: row.status,
    updatedAt: row.updatedAt,
    ...(options.now != null ? { now: options.now } : {}),
  });
  const assignee = buildSubmissionAssigneePresentation({
    assignedToUserId: row.assignedToUserId,
    currentUserId: options.currentUserId,
    assigneeDisplayName: row.assignedToUserId
      ? (options.assigneeNamesById?.get(row.assignedToUserId) ?? null)
      : null,
  });

  return {
    id: row.id,
    title: row.title,
    thumbnailUrl: row.images[0]?.trim() ? row.images[0] : null,
    categoryPreview: resolveCategoryPreview(row, options.categoryNamesById),
    sellerPreview: resolveSellerPreview(entityId, options.sellerNamesById),
    status: row.status,
    createdAtIso: toRequiredIsoString(row.createdAt),
    createdAtLabel: formatAdminTableDateTime(row.createdAt, "timestamp").primary,
    slaDays: sla.days,
    slaLabel: sla.label,
    slaTone: sla.tone,
    isOverSla: sla.isOverSla,
    qualityWarnings: submissionQualityWarningLabels(quality),
    qualityGaps: quality.gaps,
    qualitySummaryLabel: quality.summaryLabel,
    blocksAccept: quality.blocksAccept,
    assigneeLabel: assignee.label,
    assigneeUserId: assignee.userId,
    isAssignedToCurrentUser: assignee.isCurrentUser,
    isUnassigned: assignee.isUnassigned,
  };
}

export function toAdminSubmissionTableRows(
  rows: AdminSubmissionListRow[],
  options: AdminSubmissionTableRowOptions,
): AdminSubmissionTableRow[] {
  return rows.map((row) => toAdminSubmissionTableRow(row, options));
}

export function isSerializableSubmissionTableRow(row: AdminSubmissionTableRow): boolean {
  try {
    JSON.stringify(row);
    return true;
  } catch {
    return false;
  }
}
