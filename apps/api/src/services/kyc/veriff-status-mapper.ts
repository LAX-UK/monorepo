import type { KycVerification, UserKycStatus } from "@auction/types";
import type { KycDecisionApplyInput } from "./kyc-decision-processor.js";
import { extractVerifiedFieldsFromVeriffDecision } from "./kyc-verified-fields.js";

export type VeriffVerificationDecision = {
  id: string;
  attemptId?: string | null;
  status: string;
  reasonCode?: number | null;
  person?: Record<string, unknown> | null;
  document?: Record<string, unknown> | null;
  decisionTime?: string | null;
};

/** Fraud / hard-fail reason codes — increment retry count. */
const VERIFF_HARD_FAILURE_REASON_CODES = new Set([
  101, 103, 104, 105, 106, 108, 109, 110, 539, 502, 503, 504, 505, 506, 512, 513, 514, 516, 517,
  518, 519, 520, 521, 522, 523, 524, 525, 529, 538, 556, 567, 568, 569, 570, 571, 572, 573, 574,
  575, 576, 577, 578, 579, 580, 581, 582, 583, 584, 585, 586, 587, 602, 620, 621, 622, 623,
]);

function mapVerificationStatus(status: string): KycVerification["status"] {
  switch (status) {
    case "approved":
      return "verified";
    case "resubmission_requested":
      return "requires_input";
    case "declined":
    case "expired":
    case "abandoned":
      return "canceled";
    case "review":
    case "submitted":
      return "processing";
    default:
      return "created";
  }
}

function userKycUpdateFromVeriffDecision(
  status: string,
  reasonCode: number | null | undefined,
): KycDecisionApplyInput["userKycUpdate"] {
  if (status === "approved") {
    return { setStatus: "approved", verifiedAt: new Date(), incrementRetry: false };
  }
  if (status === "resubmission_requested") {
    return { setStatus: "pending", verifiedAt: null, incrementRetry: false };
  }
  if (status === "review" || status === "submitted") {
    return { setStatus: "pending", verifiedAt: null, incrementRetry: false };
  }
  if (status === "declined") {
    const incrementRetry = reasonCode != null && VERIFF_HARD_FAILURE_REASON_CODES.has(reasonCode);
    return { setStatus: "rejected", verifiedAt: null, incrementRetry };
  }
  if (status === "expired" || status === "abandoned") {
    return { setStatus: "unverified", verifiedAt: null, incrementRetry: false };
  }
  return { setStatus: "pending", verifiedAt: null, incrementRetry: false };
}

export function mapVeriffDecisionToApplyInput(
  verification: VeriffVerificationDecision,
  decisionPayload: Record<string, unknown>,
): KycDecisionApplyInput {
  const status = verification.status;
  const verificationStatus = mapVerificationStatus(status);
  const userKycUpdate = userKycUpdateFromVeriffDecision(status, verification.reasonCode);
  const isTerminal = ["approved", "declined", "expired", "abandoned"].includes(status);

  return {
    providerSessionId: verification.id,
    providerAttemptId: verification.attemptId ?? null,
    verificationStatus,
    userKycUpdate,
    verifiedFields: extractVerifiedFieldsFromVeriffDecision({
      person: verification.person as {
        firstName?: string;
        lastName?: string;
        dateOfBirth?: string;
      },
      document: verification.document as {
        number?: string;
        type?: string;
        country?: string;
        validUntil?: string;
      },
    }),
    decisionPayload,
    decisionAt: isTerminal
      ? verification.decisionTime
        ? new Date(verification.decisionTime)
        : new Date()
      : null,
    isApproved: status === "approved",
  };
}

/** Maps Veriff event webhook `action` to verification status update (optional UX path). */
export function mapVeriffEventToVerificationStatus(
  action: string,
): KycVerification["status"] | null {
  if (action === "submitted") return "processing";
  if (action === "started") return "created";
  return null;
}

export function mapVeriffEventToUserStatus(action: string): UserKycStatus | null {
  if (action === "submitted" || action === "started") return "pending";
  return null;
}
