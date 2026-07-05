import type { KycStatusSummaryDto, KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { toObjectRecord } from "@/lib/data/http/object-guards";

function parseKycUserFeedback(raw: unknown): KycUserFeedbackDto {
  const row = toObjectRecord(raw);
  const action = row.action;
  const parsedAction =
    action === "start" ||
    action === "continue" ||
    action === "retry" ||
    action === "wait" ||
    action === "none"
      ? action
      : "none";
  return {
    headline: String(row.headline ?? ""),
    detail: row.detail == null ? null : String(row.detail),
    action: parsedAction,
    reasonCode: row.reasonCode == null ? null : Number(row.reasonCode),
    decisionStatus: row.decisionStatus == null ? null : String(row.decisionStatus),
    needsResubmit: Boolean(row.needsResubmit),
  };
}

/** Row parser for `GET /kyc/status`. */
export function parseKycStatusSummary(raw: unknown): KycStatusSummaryDto {
  const row = toObjectRecord(raw);
  const status = row.status;
  const parsedStatus =
    status === "unverified" ||
    status === "pending" ||
    status === "approved" ||
    status === "rejected"
      ? status
      : "unverified";
  const latestSessionStatus = row.latestSessionStatus;
  const parsedSessionStatus =
    latestSessionStatus === "created" ||
    latestSessionStatus === "requires_input" ||
    latestSessionStatus === "processing" ||
    latestSessionStatus === "verified" ||
    latestSessionStatus === "canceled"
      ? latestSessionStatus
      : null;
  const exposure = toObjectRecord(row.pendingExposure);
  return {
    status: parsedStatus,
    verifiedAt: row.verifiedAt == null ? null : String(row.verifiedAt),
    latestSessionId: row.latestSessionId == null ? null : String(row.latestSessionId),
    latestSessionStatus: parsedSessionStatus,
    feedback: parseKycUserFeedback(row.feedback),
    pendingExposure: {
      total: Number(exposure.total ?? 0),
      currency: String(exposure.currency ?? ""),
    },
    thresholdAmount: Number(row.thresholdAmount ?? 0),
    thresholdCurrency: String(row.thresholdCurrency ?? ""),
    requiresKyc: Boolean(row.requiresKyc),
  };
}
