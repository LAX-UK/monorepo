import type { conditionReportRequest } from "@auction/db/schema";
import type { Lot } from "@auction/types";
import type { ConditionReportRequestRow } from "../interfaces/condition-report-request.repository.js";

export const OPEN_LOT_STATUSES = new Set<Lot["status"]>(["scheduled", "active"]);
export const OPEN_REQUEST_STATUSES = ["pending", "in_progress"] as const;

export function extractConditionReportDownloadUrl(
  marketingDetails: Lot["marketingDetails"] | null | undefined,
): string | null {
  const cr = marketingDetails?.conditionReport;
  const url = cr?.downloadUrl;
  if (typeof url !== "string" || url.trim() === "") return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function mapRequestRow(
  r: typeof conditionReportRequest.$inferSelect,
): ConditionReportRequestRow {
  return {
    id: r.id,
    lotId: r.lotId,
    requestedByUserId: r.requestedByUserId,
    requestingLegalEntityId: r.requestingLegalEntityId,
    status: r.status as ConditionReportRequestRow["status"],
    requestNote: r.requestNote,
    responseNote: r.responseNote,
    responseAttachmentUploadId: r.responseAttachmentUploadId,
    fulfilledByUserId: r.fulfilledByUserId,
    fulfilledAt: r.fulfilledAt,
    createdAt: r.createdAt,
  };
}
