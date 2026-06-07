import { readVeriffReasonCode } from "./kyc-user-feedback.js";

const STAFF_REASON_LABELS: Record<number, string> = {
  201: "Document quality issue",
  202: "Selfie quality issue",
  203: "Document not fully visible",
  204: "Poor lighting or blur",
  205: "Damaged document",
  206: "Unsupported document type",
  207: "Expired document",
  208: "Selfie missing",
  209: "Document photo missing",
  539: "Resubmission limit reached",
  9102: "Verification declined",
  9103: "Resubmission requested",
  9104: "Session expired",
  9121: "Session abandoned",
};

export type KycDecisionSummary = {
  decisionStatus: string | null;
  decisionReasonCode: number | null;
  decisionReasonLabel: string | null;
};

function readVeriffDecision(decisionPayload: Record<string, unknown> | null): {
  status: string | null;
  reason: string | null;
  reasonCode: number | null;
} {
  const verification = decisionPayload?.verification;
  if (!verification || typeof verification !== "object") {
    return { status: null, reason: null, reasonCode: null };
  }
  const v = verification as Record<string, unknown>;
  return {
    status: typeof v.status === "string" ? v.status : null,
    reason: typeof v.reason === "string" ? v.reason.trim() || null : null,
    reasonCode: typeof v.reasonCode === "number" ? v.reasonCode : null,
  };
}

/** Staff-facing summary derived from stored Veriff decision payload (no raw payload to client). */
export function summarizeVeriffDecision(
  decisionPayload: Record<string, unknown> | null,
): KycDecisionSummary {
  const decision = readVeriffDecision(decisionPayload);
  const reasonCode = decision.reasonCode ?? readVeriffReasonCode(decisionPayload);
  const mappedLabel = reasonCode != null ? (STAFF_REASON_LABELS[reasonCode] ?? null) : null;
  const decisionReasonLabel = decision.reason ?? mappedLabel;

  return {
    decisionStatus: decision.status,
    decisionReasonCode: reasonCode,
    decisionReasonLabel,
  };
}
