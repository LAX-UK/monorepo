import type { itemSubmission } from "@auction/db/schema";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

type ItemSubmissionRow = InferSelectModel<typeof itemSubmission>;

function requireBackfilledLegalEntityId(value: string | null, context: string): string {
  if (!value) {
    throw new Error(`missing_backfilled_legal_entity_id:${context}`);
  }
  return value;
}

export function mapItemSubmissionRow(
  row: ItemSubmissionRow,
  categoryIds: string[] = [],
): ItemSubmission {
  const primaryCategoryId = categoryIds[0] ?? "";
  return {
    id: row.id,
    legalEntityId: requireBackfilledLegalEntityId(row.legalEntityId, `item_submission:${row.id}`),
    title: row.title,
    description: row.description,
    medium: row.medium,
    dimensions: row.dimensions,
    images: row.images ?? [],
    yearOfWork: row.yearOfWork,
    isSigned: row.isSigned,
    signatureNote: row.signatureNote,
    edition: row.edition,
    conditionSelfReport: row.conditionSelfReport,
    provenance: row.provenance ?? [],
    exhibitions: row.exhibitions ?? [],
    askingPrice: row.askingPrice !== null ? String(row.askingPrice) : null,
    reservePrice: row.reservePrice !== null ? String(row.reservePrice) : null,
    categoryIds,
    categoryId: primaryCategoryId,
    submitterNotes: row.submitterNotes,
    status: row.status as ItemSubmissionStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ?? null,
    reviewNotes: row.reviewNotes,
    rejectionReason: row.rejectionReason,
    convertedLotId: row.convertedLotId,
    assignedToUserId: row.assignedToUserId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type { ItemSubmissionRow };
